import { redirect } from "next/navigation";
import { PlatformOperationsPanel } from "@/components/platform-operations-panel";
import { FOUNDATION_PLAN, getOrganizationSeatLimit } from "@/lib/billing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceProfile } from "@/lib/workspace";

type AwardTier = "bronze" | "silver" | "gold" | "platinum";

function isAwardTier(value: unknown): value is AwardTier {
  return value === "bronze" || value === "silver" || value === "gold" || value === "platinum";
}

export default async function PlatformOperationsPage() {
  const { profile } = await requireWorkspaceProfile();
  if (profile.role !== "system_admin") redirect("/dashboard");

  const admin = createSupabaseAdminClient();

  const [requests, organizationsResult, usersResult, candidatesResult, settings, awardEventsResult] = await Promise.all([
    admin.from("platform_account_requests").select("id, full_name, company_name, phone, email, role_title, status, created_at, notes").in("status", ["new", "contacted"]).order("created_at", { ascending: false }),
    admin.from("organizations").select("id, name, manual_access_status, manual_access_note, subscription_status, billing_contact_email, included_seats, additional_seat_packs").order("name"),
    admin.from("organization_users").select("organization_id, first_name, last_name, status, last_login_at, is_candidate, is_mentor"),
    admin.from("candidates").select("organization_id"),
    admin.from("platform_settings").select("sales_notification_email, reminders_enabled").eq("id", true).single(),
    admin.from("platform_audit_events").select("id, organization_id, details, created_at").eq("event_type", "organization_award_reached").order("created_at", { ascending: false }).limit(12),
  ]);
  for (const result of [requests, organizationsResult, usersResult, candidatesResult, settings, awardEventsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const organizations = organizationsResult.data ?? [];
  const users = usersResult.data ?? [];
  const candidates = candidatesResult.data ?? [];
  const organizationUsage = organizations.map((organization) => {
    const organizationUsers = users.filter((user) => user.organization_id === organization.id);
    const activeUsers = organizationUsers.filter((user) => user.status === "active");
    const billableUsers = organizationUsers.filter((user) => user.status === "active" || user.status === "invited");
    const seatLimit = getOrganizationSeatLimit({ included_seats: organization.included_seats, additional_seat_packs: organization.additional_seat_packs });
    return {
      id: organization.id,
      name: organization.name,
      peopleCount: organizationUsers.length,
      activeUsers: activeUsers.length,
      signedInUsers: activeUsers.filter((user) => Boolean(user.last_login_at)).length,
      neverSignedInUsers: activeUsers.filter((user) => !user.last_login_at).map((user) => `${user.first_name} ${user.last_name}`),
      inactiveUsers: organizationUsers.filter((user) => user.status === "suspended" || user.status === "archived").length,
      candidateCount: candidates.filter((candidate) => candidate.organization_id === organization.id).length,
      mentorCount: activeUsers.filter((user) => user.is_mentor).length,
      billableSeatsUsed: billableUsers.length,
      seatLimit,
      additionalSeatPacks: organization.additional_seat_packs ?? 0,
      subscriptionStatus: organization.subscription_status ?? "not configured",
      billingContactEmail: organization.billing_contact_email,
    };
  });
  const awardNotifications = (awardEventsResult.data ?? []).flatMap((event) => {
    const details = event.details as { award_tier?: unknown; organization_name?: unknown } | null;
    return event.organization_id && isAwardTier(details?.award_tier) && typeof details?.organization_name === "string"
      ? [{ id: event.id, organizationId: event.organization_id, organizationName: details.organization_name, tier: details.award_tier, reachedAt: event.created_at }]
      : [];
  });

  return (
    <main className="app-page">
      <div className="mx-auto w-full max-w-[1380px] px-6 py-12 sm:px-10 lg:px-12">
        <section className="mb-8">
          <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">System administration</p>
          <h1 className="mt-3 font-display text-5xl">Platform operations</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">Monitor customer adoption, seat utilization, subscription posture, and succession-award progress across every organization.</p>
        </section>
        <PlatformOperationsPanel
          requests={requests.data ?? []}
          organizations={organizations.map(({ id, name, manual_access_status, manual_access_note }) => ({ id, name, manual_access_status, manual_access_note }))}
          organizationUsage={organizationUsage}
          awardNotifications={awardNotifications}
          foundationAnnualPrice={FOUNDATION_PLAN.annualPriceDollars}
          salesNotificationEmail={settings.data?.sales_notification_email ?? null}
          remindersEnabled={settings.data?.reminders_enabled ?? true}
        />
      </div>
    </main>
  );
}
