import Link from "next/link";
import {
  formatSubscriptionProductLabel,
  formatOrganizationSubscriptionLabel,
  formatOrganizationTrialEndDate,
  getProductTier,
  hasProductAccess,
  type OrganizationSubscriptionState,
  type SubscriptionProduct,
} from "@/lib/subscription";

const productDescriptions: Record<SubscriptionProduct, string[]> = {
  leadership_continuity: [
    "Role composites and succession standards",
    "Candidate readiness analysis and mentor reports",
    "Mentoring workspaces, worksheets, and continuity intelligence",
  ],
  leadership_help: [
    "Current-role development workflows",
    "Challenge support with AI guidance",
    "Request and track human coaching support",
  ],
};

type SubscriptionPaywallPanelProps = {
  organizationName: string;
  subscription: OrganizationSubscriptionState;
};

export function SubscriptionPaywallPanel({
  organizationName,
  subscription,
}: SubscriptionPaywallPanelProps) {
  const trialEndLabel = formatOrganizationTrialEndDate(subscription.trialEndsAt);
  const statusLabel = formatOrganizationSubscriptionLabel(subscription);
  const activationMailto = `mailto:${subscription.billingContactEmail}?subject=${encodeURIComponent(
    `Activate Leadership Continuity products for ${organizationName}`,
  )}`;
  const returnHref = hasProductAccess(subscription, "leadership_continuity")
    ? "/dashboard"
    : hasProductAccess(subscription, "leadership_help")
      ? "/leadership-help"
      : "/";
  const returnLabel = hasProductAccess(subscription, "leadership_continuity")
    ? "Return to Dashboard"
    : hasProductAccess(subscription, "leadership_help")
      ? "Open Leadership Help"
      : "Back to Overview";

  return (
    <section className="theme-panel-strong rounded-[2rem] p-6 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-1 text-xs font-semibold tracking-[0.22em] text-amber-900 uppercase">
          {subscription.hasAccess ? "Billing Status" : "LCS Paywall"}
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-semibold tracking-[0.18em] text-slate-700 uppercase">
          {statusLabel}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h1 className="font-display text-4xl leading-tight text-slate-900 sm:text-5xl">
            {subscription.hasAccess
              ? `Product access is configured for ${organizationName}`
              : `Unlock Leadership Continuity and Leadership Help for ${organizationName}`}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            {subscription.hasAccess
              ? "This organization can be granted Leadership Continuity, Leadership Help, or both. Use this page as the billing checkpoint for the shared platform."
              : "This workspace is outside its active trial or paid access window. Renew access before your team can work in the licensed products again."}
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Access Tier
              </p>
              <p className="mt-3 text-2xl font-semibold capitalize text-slate-950">
                {subscription.tier}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Trial Ends
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">
                {trialEndLabel ?? "Not set"}
              </p>
              {subscription.isTrialActive ? (
                <p className="mt-2 text-sm text-slate-600">
                  {subscription.daysRemaining} day
                  {subscription.daysRemaining === 1 ? "" : "s"} remaining
                </p>
              ) : null}
            </article>
            <article className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Billing Contact
              </p>
              <p className="mt-3 break-all text-base font-semibold text-slate-950">
                {subscription.billingContactEmail}
              </p>
            </article>
          </div>
        </div>

        <aside className="rounded-[1.75rem] bg-[#04111f] p-6 text-white shadow-[0_30px_90px_rgba(2,6,23,0.28)]">
          <p className="text-xs font-semibold tracking-[0.22em] text-amber-200 uppercase">
            Product Access
          </p>
          <div className="mt-5 space-y-4">
            {(["leadership_continuity", "leadership_help"] as const).map((product) => (
              <div
                key={product}
                className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">
                    {formatSubscriptionProductLabel(product)}
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase text-slate-200">
                    {hasProductAccess(subscription, product) ? "Enabled" : "Not enabled"}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold tracking-[0.14em] uppercase text-slate-400">
                  Tier: {getProductTier(subscription, product)}
                </p>
                <div className="mt-3 space-y-2">
                  {productDescriptions[product].map((item) => (
                    <div
                      key={item}
                      className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3 text-sm leading-7 text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {!subscription.hasAccess ? (
        <div className="mt-8 rounded-[1.5rem] border border-dashed border-slate-300 bg-white/75 px-5 py-5 text-sm leading-7 text-slate-700">
          Billing checkout is not wired yet in this MVP. To restore access, connect
          your payment flow or activate the organization manually by updating the
          organization subscription record.
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={activationMailto}
          className="interactive-contrast inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
        >
          {subscription.hasAccess ? "Contact Billing" : "Request Activation"}
        </a>
        <Link
          href={returnHref}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          {returnLabel}
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Back to Overview
        </Link>
      </div>
    </section>
  );
}
