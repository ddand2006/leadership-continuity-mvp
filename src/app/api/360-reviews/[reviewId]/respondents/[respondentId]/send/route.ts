import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminAppRole } from "@/lib/mentor-access";
import { requireWorkspaceProfile } from "@/lib/workspace";
import { getAppUrl, hasResendEnv } from "@/lib/env";
import { createReview360Token, hashReview360Token } from "@/lib/review-360";
import { sendResendEmail } from "@/lib/resend";

type Context = { params: Promise<{ reviewId: string; respondentId: string }> };
const relationshipLabel: Record<string, string> = { self: "self", supervisor: "supervisor", peer: "peer or coworker", direct_report: "direct report", other: "colleague" };
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export async function POST(_: Request, context: Context) {
  try {
    const { reviewId, respondentId } = await context.params;
    const { profile } = await requireWorkspaceProfile();
    if (!isAdminAppRole(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!hasResendEnv()) return NextResponse.json({ error: "Email delivery is not configured." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const [cycle, respondent] = await Promise.all([
      admin.from("review_360_cycles").select("title,role_title,due_date,employee_organization_user_id").eq("id", reviewId).eq("organization_id", profile.organization_id).single(),
      admin.from("review_360_respondents").select("id,first_name,last_name,email,status,invited_relationship").eq("id", respondentId).eq("review_cycle_id", reviewId).eq("organization_id", profile.organization_id).single(),
    ]);
    if (cycle.error || respondent.error) throw cycle.error ?? respondent.error;
    if (respondent.data.status === "completed") return NextResponse.json({ error: "Completed responses cannot be resent." }, { status: 409 });

    const employee = await admin.from("organization_users").select("first_name,last_name").eq("id", cycle.data.employee_organization_user_id).single();
    if (employee.error) throw employee.error;
    const employeeName = `${employee.data.first_name} ${employee.data.last_name}`;
    const token = createReview360Token();
    const link = `${getAppUrl().replace(/\/$/, "")}/360-review/survey/${token}`;
    const dueDate = cycle.data.due_date ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${cycle.data.due_date}T00:00:00Z`)) : "the review due date";
    const safe = { recipient: escapeHtml(respondent.data.first_name), employee: escapeHtml(employeeName), role: escapeHtml(cycle.data.role_title), relationship: relationshipLabel[respondent.data.invited_relationship] ?? "colleague", dueDate: escapeHtml(dueDate), link: escapeHtml(link) };

    await sendResendEmail({
      to: respondent.data.email,
      subject: `Invitation: confidential 360 feedback for ${employeeName}`,
      text: `Hello ${respondent.data.first_name},\n\nYou have been invited to provide confidential 360° feedback for ${employeeName}, ${cycle.data.role_title}. You were selected as a ${safe.relationship}.\n\nYour perspective will help ${employeeName} understand how their day-to-day leadership is experienced. Please answer honestly and fairly, based on the behaviors you have personally observed. This is a developmental review, not a performance decision.\n\nYour individual answers are not shown in the results. Peer and direct-report feedback is combined and protected until the minimum response threshold is met.\n\nPlease complete the review by ${dueDate}:\n${link}\n\nThank you for taking the time to provide thoughtful feedback.\n\nLeadership Continuity`,
      html: `<main style="max-width:620px;margin:0 auto;padding:32px 24px;font-family:Arial,sans-serif;color:#1e293b;line-height:1.55"><p style="margin:0 0 24px;color:#0f766e;font-size:13px;font-weight:700;letter-spacing:1.6px">LEADERSHIP CONTINUITY</p><h1 style="margin:0 0 16px;color:#0f2f5d;font-family:Georgia,serif;font-size:30px;line-height:1.2">Your perspective matters.</h1><p>Hello ${safe.recipient},</p><p>You have been invited to provide a confidential 360° review for <strong>${safe.employee}</strong>, <strong>${safe.role}</strong>. You were selected as a ${safe.relationship}.</p><p>Your perspective will help ${safe.employee} understand how their day-to-day leadership is experienced. Please answer honestly and fairly, based on the behaviors you have personally observed.</p><div style="margin:24px 0;padding:20px;border-radius:12px;background:#f0fdfa"><strong style="color:#134e4a">Your feedback is confidential and developmental.</strong><p style="margin:8px 0 0">Individual answers are not shown in the results. Peer and direct-report feedback is combined and protected until the minimum response threshold is met. This review supports growth; it is not a performance decision.</p></div><p>Please complete the review by <strong>${safe.dueDate}</strong>.</p><p style="margin:28px 0"><a href="${safe.link}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#0f2f5d;color:#ffffff;text-decoration:none;font-weight:700">Begin confidential 360 review</a></p><p style="font-size:14px;color:#475569">Thank you for taking the time to provide thoughtful, constructive feedback.</p></main>`,
      idempotencyKey: `360-${respondentId}-${Date.now()}`,
    });

    const now = new Date().toISOString();
    const updated = await admin.from("review_360_respondents").update({ token_hash: hashReview360Token(token), status: "pending", invited_at: now }).eq("id", respondentId);
    if (updated.error) throw updated.error;
    await admin.from("review_360_cycles").update({ status: "invitations_pending", launched_at: now }).eq("id", reviewId).eq("status", "draft");
    return NextResponse.json({ message: `Invitation sent to ${respondent.data.first_name}.` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send invitation." }, { status: 400 });
  }
}
