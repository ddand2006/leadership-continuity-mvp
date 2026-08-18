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
    const existing = await admin.from("platform_account_requests").select("id, status").eq("auth_user_id", user.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return NextResponse.json({ requestId: existing.data.id, status: existing.data.status, alreadyExists: true });
    const insert = await admin.from("platform_account_requests").insert({
      auth_user_id: user.id, full_name: metadata.fullName, company_name: metadata.companyName,
      phone: metadata.phone, email: user.email.trim().toLowerCase(), role_title: metadata.roleTitle,
    }).select("id").single();
    if (insert.error) throw insert.error;
    await admin.from("platform_audit_events").insert({ account_request_id: insert.data.id, event_type: "account_request_received", details: { companyName: metadata.companyName } });
    const settings = await admin.from("platform_settings").select("sales_notification_email").eq("id", true).maybeSingle();
    if (settings.data?.sales_notification_email && hasResendEnv()) {
      await sendResendEmail({
        to: settings.data.sales_notification_email,
        subject: `New Leadership Continuity account request — ${metadata.companyName}`,
        text: `${metadata.fullName} (${metadata.roleTitle}) requested an account for ${metadata.companyName}. Email: ${user.email}. Phone: ${metadata.phone}.`,
        html: `<p><strong>${metadata.fullName}</strong> (${metadata.roleTitle}) requested an account for <strong>${metadata.companyName}</strong>.</p><p>Email: ${user.email}<br/>Phone: ${metadata.phone}</p>`,
        idempotencyKey: `account-request-${insert.data.id}`,
      });
    }
    return NextResponse.json({ requestId: insert.data.id, status: "new" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit the account request." }, { status: 400 });
  }
}
