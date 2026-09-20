import { getOwnedAffiliates } from "@/lib/affiliate-access";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasResendEnv } from "@/lib/env";
import { sendResendEmail } from "@/lib/resend";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const accountRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  companyName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(7).max(50),
  roleTitle: z.string().trim().min(2).max(160),
});

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const metadata = accountRequestSchema.parse(user.user_metadata?.account_request);
    const admin = createSupabaseAdminClient();
    const existingProfile = await admin
      .from("profiles")
      .select("id, organization_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (existingProfile.error) throw existingProfile.error;
    if (existingProfile.data) {
      return NextResponse.json({
        organizationId: existingProfile.data.organization_id,
        workspaceCreated: true,
      });
    }

    if ((await getOwnedAffiliates(user)).length) return NextResponse.json({ error: "Use your free affiliate portal. Program access must be assigned separately by an administrator." }, { status: 403 });

    const existing = await admin.from("platform_account_requests").select("id, status").eq("auth_user_id", user.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return NextResponse.json({ requestId: existing.data.id, status: existing.data.status, alreadyExists: true });

    const existingOrganization = await admin
      .from("organizations")
      .select("id")
      .eq("name", metadata.companyName)
      .maybeSingle();
    if (existingOrganization.error) throw existingOrganization.error;
    if (existingOrganization.data) {
      return NextResponse.json(
        { error: "An organization with this name already exists. Contact us so we can help you join the correct workspace." },
        { status: 409 },
      );
    }

    // Resolve public referral codes on the server; rates never come from signup metadata.
    const referralSlug = user.user_metadata?.affiliate_slug;
    let affiliateId: string | null = null;
    if (typeof referralSlug === "string" && referralSlug) {
      const referral = await admin.from("affiliates").select("id").eq("slug", referralSlug).eq("is_sandbox", false).not("published_branding", "is", null).maybeSingle();
      if (referral.error) throw referral.error;
      if (!referral.data) return NextResponse.json({ error: "This partner page is no longer accepting referrals. Contact Leadership Continuity for help." }, { status: 409 });
      affiliateId = referral.data.id;
    }
    const normalizedEmail = user.email.trim().toLowerCase();
    const organizationResult = await admin
      .from("organizations")
      .insert({
        name: metadata.companyName,
        ...(affiliateId ? { affiliate_id: affiliateId } : {}),
        billing_contact_email: normalizedEmail,
        subscription_status: "canceled",
        leadership_continuity_enabled: false,
        leadership_continuity_tier: "foundation",
        leadership_help_enabled: false,
        leadership_help_tier: "none",
        included_seats: 10,
      })
      .select("id")
      .single();
    if (organizationResult.error) throw organizationResult.error;

    const [firstName, ...lastNameParts] = metadata.fullName.split(/\s+/);
    const profileResult = await admin
      .from("profiles")
      .insert({
        auth_user_id: user.id,
        organization_id: organizationResult.data.id,
        full_name: metadata.fullName,
        email: normalizedEmail,
        role: "hospital_admin",
        position_title: metadata.roleTitle,
      })
      .select("id")
      .single();
    if (profileResult.error) throw profileResult.error;

    const organizationUserResult = await admin.from("organization_users").insert({
      organization_id: organizationResult.data.id,
      auth_user_id: user.id,
      profile_id: profileResult.data.id,
      first_name: firstName || "Admin",
      last_name: lastNameParts.join(" ") || "Admin",
      email: normalizedEmail,
      admin_role: "ceo_admin",
      status: "active",
      activated_at: new Date().toISOString(),
      created_by_profile_id: profileResult.data.id,
      updated_by_profile_id: profileResult.data.id,
    });
    if (organizationUserResult.error) throw organizationUserResult.error;

    const enrollmentResult = await admin.from("platform_account_requests").insert({
      auth_user_id: user.id,
      organization_id: organizationResult.data.id,
      full_name: metadata.fullName,
      company_name: metadata.companyName,
      phone: metadata.phone,
      email: normalizedEmail,
      role_title: metadata.roleTitle,
      status: "approved",
      approved_at: new Date().toISOString(),
      notes: "Self-service enrollment created; payment selection pending.",
    }).select("id").single();
    if (enrollmentResult.error) throw enrollmentResult.error;

    await admin.from("platform_audit_events").insert({
      organization_id: organizationResult.data.id,
      account_request_id: enrollmentResult.data.id,
      event_type: "self_service_organization_created",
      details: { companyName: metadata.companyName },
    });
    const settings = await admin.from("platform_settings").select("sales_notification_email").eq("id", true).maybeSingle();
    if (settings.data?.sales_notification_email && hasResendEnv()) {
      await sendResendEmail({
        to: settings.data.sales_notification_email,
        subject: `New self-service Leadership Continuity enrollment — ${metadata.companyName}`,
        text: `${metadata.fullName} (${metadata.roleTitle}) created a workspace for ${metadata.companyName} and is selecting a plan. Email: ${user.email}. Phone: ${metadata.phone}.`,
        html: `<p><strong>${metadata.fullName}</strong> (${metadata.roleTitle}) created a workspace for <strong>${metadata.companyName}</strong> and is selecting a plan.</p><p>Email: ${user.email}<br/>Phone: ${metadata.phone}</p>`,
        idempotencyKey: `self-service-enrollment-${enrollmentResult.data.id}`,
      });
    }
    return NextResponse.json({
      organizationId: organizationResult.data.id,
      workspaceCreated: true,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit the account request." }, { status: 400 });
  }
}
