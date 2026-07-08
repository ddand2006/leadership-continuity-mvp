import { redirect } from "next/navigation";
import { SubscriptionPaywallPanel } from "@/components/subscription-paywall-panel";
import { canAccessLeadershipHelpPreview } from "@/lib/leadership-help-preview";
import {
  isPaywallEnabled,
  loadOrganizationSubscription,
  type OrganizationSubscriptionClient,
} from "@/lib/subscription";
import { requireWorkspaceProfile } from "@/lib/workspace";

export default async function SubscribePage() {
  if (!isPaywallEnabled()) {
    redirect("/dashboard");
  }

  const { profile, supabase, user } = await requireWorkspaceProfile();
  const [organizationResult, subscription] = await Promise.all([
    supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .single(),
    loadOrganizationSubscription(
      supabase as unknown as OrganizationSubscriptionClient,
      profile.organization_id,
    ),
  ]);

  if (organizationResult.error) {
    throw new Error(organizationResult.error.message);
  }

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <SubscriptionPaywallPanel
          canOpenLeadershipHelp={canAccessLeadershipHelpPreview({
            email: user.email,
            organizationId: profile.organization_id,
            role: profile.role,
          })}
          organizationName={organizationResult.data.name}
          subscription={subscription}
        />
      </div>
    </main>
  );
}
