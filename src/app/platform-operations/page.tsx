import { redirect } from "next/navigation";
import { PlatformOperationsPanel } from "@/components/platform-operations-panel";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceProfile } from "@/lib/workspace";

export default async function PlatformOperationsPage() {
  const { profile } = await requireWorkspaceProfile();
  if (profile.role !== "system_admin") redirect("/dashboard");
  const admin = createSupabaseAdminClient();
  const [requests, organizations, settings] = await Promise.all([
    admin.from("platform_account_requests").select("id, full_name, company_name, phone, email, role_title, status, created_at, notes").in("status", ["new", "contacted"]).order("created_at", { ascending: false }),
    admin.from("organizations").select("id, name, manual_access_status, manual_access_note").order("name"),
    admin.from("platform_settings").select("sales_notification_email, reminders_enabled").eq("id", true).single(),
  ]);
  for (const result of [requests, organizations, settings]) if (result.error) throw new Error(result.error.message);
  return <main className="app-page"><div className="mx-auto w-full max-w-[1380px] px-6 py-12 sm:px-10 lg:px-12"><section className="mb-8"><p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">System administration</p><h1 className="mt-3 font-display text-5xl">Platform operations</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">Review new organizations, activate accounts after your sales conversation, place an organization on payment hold without deleting its data, and enter a clearly audited support view.</p></section><PlatformOperationsPanel requests={requests.data ?? []} organizations={organizations.data ?? []} salesNotificationEmail={settings.data?.sales_notification_email ?? null} remindersEnabled={settings.data?.reminders_enabled ?? true} /></div></main>;
}
