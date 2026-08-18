import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiRouteError, createApiErrorResponse, requireApiWorkspaceProfile } from "@/lib/api-route";
import { hasResendEnv } from "@/lib/env";
import { sendResendEmail } from "@/lib/resend";
import { PLATFORM_SUPPORT_ORGANIZATION_COOKIE } from "@/lib/platform-support";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), salesNotificationEmail: z.string().trim().email().or(z.literal("")), remindersEnabled: z.boolean() }),
  z.object({ action: z.literal("request-status"), requestId: z.string().uuid(), status: z.enum(["new", "contacted", "approved", "declined", "archived"]), notes: z.string().max(4000).optional() }),
  z.object({ action: z.literal("approve-request"), requestId: z.string().uuid() }),
  z.object({ action: z.literal("access-status"), organizationId: z.string().uuid(), accessStatus: z.enum(["active", "payment_hold"]), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("support-session"), organizationId: z.string().uuid(), reason: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("end-support-session") }),
  z.object({ action: z.literal("send-due-reminders") }),
]);

function requireSystemAdmin(role: string) { if (role !== "system_admin") throw new ApiRouteError("Only system administrators can use platform operations.", 403); }
function nextReviewDate(createdAt: string) {
  const ageDays = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  const days = ageDays < 90 ? 30 : ageDays < 365 ? 90 : 182;
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export async function POST(request: Request) {
  try {
    const context = await requireApiWorkspaceProfile({ requirePaid: false });
    requireSystemAdmin(context.profile.role);
    const payload = actionSchema.parse(await request.json());
    if (payload.action === "settings") {
      const result = await context.admin.from("platform_settings").upsert({ id: true, sales_notification_email: payload.salesNotificationEmail || null, reminders_enabled: payload.remindersEnabled }).select().single();
      if (result.error) throw result.error;
      return NextResponse.json({ message: "Platform notification settings saved." });
    }
    if (payload.action === "request-status") {
      const now = new Date().toISOString();
      const update = { status: payload.status, notes: payload.notes ?? null, first_contacted_at: payload.status === "contacted" ? now : undefined, declined_at: payload.status === "declined" ? now : undefined };
      const result = await context.admin.from("platform_account_requests").update(update).eq("id", payload.requestId);
      if (result.error) throw result.error;
      await context.admin.from("platform_audit_events").insert({ actor_profile_id: context.profile.id, account_request_id: payload.requestId, event_type: `account_request_${payload.status}` });
      return NextResponse.json({ message: "Account request updated." });
    }
    if (payload.action === "approve-request") {
      const requestResult = await context.admin.from("platform_account_requests").select("*").eq("id", payload.requestId).single();
      if (requestResult.error) throw requestResult.error;
      const accountRequest = requestResult.data;
      if (!accountRequest.auth_user_id) throw new ApiRouteError("This request is not linked to an authenticated account.", 400);
      const existingProfile = await context.admin.from("profiles").select("id").eq("auth_user_id", accountRequest.auth_user_id).maybeSingle();
      if (existingProfile.data) throw new ApiRouteError("This account already has an active workspace profile.", 409);
      const existingOrg = await context.admin.from("organizations").select("id").eq("name", accountRequest.company_name).maybeSingle();
      if (existingOrg.data) throw new ApiRouteError("An organization with this name already exists. Update the request and create it from Administration instead.", 409);
      const org = await context.admin.from("organizations").insert({ name: accountRequest.company_name, billing_contact_email: accountRequest.email, subscription_status: "trialing", leadership_continuity_enabled: true, leadership_continuity_tier: "organization", leadership_help_enabled: false, leadership_help_tier: "none", included_seats: 10 }).select("id").single();
      if (org.error) throw org.error;
      const [firstName, ...lastNameParts] = accountRequest.full_name.trim().split(/\s+/);
      const profile = await context.admin.from("profiles").insert({ auth_user_id: accountRequest.auth_user_id, organization_id: org.data.id, full_name: accountRequest.full_name, email: accountRequest.email, role: "hospital_admin", position_title: accountRequest.role_title }).select("id").single();
      if (profile.error) throw profile.error;
      const user = await context.admin.from("organization_users").insert({ organization_id: org.data.id, auth_user_id: accountRequest.auth_user_id, profile_id: profile.data.id, first_name: firstName || "Admin", last_name: lastNameParts.join(" ") || "Admin", email: accountRequest.email, admin_role: "ceo_admin", status: "active", activated_at: new Date().toISOString(), created_by_profile_id: context.profile.id, updated_by_profile_id: context.profile.id });
      if (user.error) throw user.error;
      const update = await context.admin.from("platform_account_requests").update({ status: "approved", organization_id: org.data.id, approved_at: new Date().toISOString() }).eq("id", payload.requestId);
      if (update.error) throw update.error;
      await context.admin.from("platform_audit_events").insert({ actor_profile_id: context.profile.id, organization_id: org.data.id, account_request_id: payload.requestId, event_type: "account_request_approved" });
      return NextResponse.json({ message: `${accountRequest.company_name} is active and its administrator can now sign in.`, organizationId: org.data.id });
    }
    if (payload.action === "access-status") {
      const result = await context.admin.from("organizations").update({ manual_access_status: payload.accessStatus, manual_access_note: payload.note || null, manual_access_changed_at: new Date().toISOString(), manual_access_changed_by_profile_id: context.profile.id }).eq("id", payload.organizationId);
      if (result.error) throw result.error;
      await context.admin.from("platform_audit_events").insert({ actor_profile_id: context.profile.id, organization_id: payload.organizationId, event_type: payload.accessStatus === "payment_hold" ? "organization_payment_hold" : "organization_access_restored", details: { note: payload.note || null } });
      return NextResponse.json({ message: payload.accessStatus === "payment_hold" ? "Organization access is now on payment hold. Data is preserved." : "Organization access has been restored." });
    }
    if (payload.action === "support-session") {
      const organization = await context.admin.from("organizations").select("id, name").eq("id", payload.organizationId).maybeSingle();
      if (organization.error) throw organization.error;
      if (!organization.data) throw new ApiRouteError("Organization not found.", 404);
      const result = await context.admin.from("platform_support_sessions").insert({ system_admin_profile_id: context.profile.id, organization_id: payload.organizationId, reason: payload.reason || null }).select("id").single();
      if (result.error) throw result.error;
      await context.admin.from("platform_audit_events").insert({ actor_profile_id: context.profile.id, organization_id: payload.organizationId, event_type: "support_workspace_opened", details: { reason: payload.reason || null } });
      const response = NextResponse.json({ message: `Opening ${organization.data.name} workspace.`, sessionId: result.data.id, workspaceUrl: "/dashboard" });
      response.cookies.set(PLATFORM_SUPPORT_ORGANIZATION_COOKIE, organization.data.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
      return response;
    }
    if (payload.action === "end-support-session") {
      const now = new Date().toISOString();
      const sessions = await context.admin.from("platform_support_sessions").update({ ended_at: now }).eq("system_admin_profile_id", context.profile.id).is("ended_at", null);
      if (sessions.error) throw sessions.error;
      await context.admin.from("platform_audit_events").insert({ actor_profile_id: context.profile.id, event_type: "support_workspace_closed" });
      const response = NextResponse.json({ message: "Returned to your platform workspace.", workspaceUrl: "/platform-operations" });
      response.cookies.set(PLATFORM_SUPPORT_ORGANIZATION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
      return response;
    }
    const settings = await context.admin.from("platform_settings").select("sales_notification_email, reminders_enabled").eq("id", true).single();
    if (settings.error) throw settings.error;
    if (!settings.data.reminders_enabled || !settings.data.sales_notification_email || !hasResendEnv()) return NextResponse.json({ message: "No due reminders were sent. Add a notification email and enable reminders first." });
    const due = await context.admin.from("platform_account_requests").select("id, full_name, company_name, email, role_title, created_at").in("status", ["new", "contacted"]).lte("next_review_at", new Date().toISOString());
    if (due.error) throw due.error;
    for (const item of due.data ?? []) {
      await sendResendEmail({ to: settings.data.sales_notification_email, subject: `Follow up: ${item.company_name} account request`, text: `${item.full_name} (${item.role_title}) at ${item.company_name} requested access. Email: ${item.email}.`, html: `<p><strong>${item.company_name}</strong> is due for follow-up.</p><p>${item.full_name} (${item.role_title})<br/>${item.email}</p>`, idempotencyKey: `platform-reminder-${item.id}-${new Date().toISOString().slice(0, 10)}` });
      await context.admin.from("platform_account_requests").update({ last_reminder_sent_at: new Date().toISOString(), next_review_at: nextReviewDate(item.created_at) }).eq("id", item.id);
    }
    return NextResponse.json({ message: `${due.data?.length ?? 0} follow-up reminder(s) sent.` });
  } catch (error) { return createApiErrorResponse(error, "Unable to update platform operations."); }
}
