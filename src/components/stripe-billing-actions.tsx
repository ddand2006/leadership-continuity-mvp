"use client";

import { useState } from "react";

type StripeBillingActionsProps = {
  additionalSeatPacks: number;
  canManageBilling: boolean;
  hasStripeSubscription: boolean;
  stripeConfigured: boolean;
};

async function startBillingAction(endpoint: string) {
  const response = await fetch(endpoint, { method: "POST" });
  const payload = (await response.json()) as { error?: string; message?: string; url?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to start billing.");
  }

  if (payload.url) {
    window.location.assign(payload.url);
    return;
  }

  return payload.message ?? "Billing updated.";
}

export function StripeBillingActions({
  additionalSeatPacks,
  canManageBilling,
  hasStripeSubscription,
  stripeConfigured,
}: StripeBillingActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (!canManageBilling) {
    return null;
  }

  const nextSeatPackPrice = additionalSeatPacks === 0 ? "$1,350/year" : "$1,150/year";

  async function handleAction(endpoint: string, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) {
      return;
    }

    setIsPending(true);
    setMessage(null);
    try {
      const nextMessage = await startBillingAction(endpoint);
      if (nextMessage) {
        setMessage(nextMessage);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update billing.");
    } finally {
      setIsPending(false);
    }
  }

  if (!stripeConfigured) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        Stripe checkout will appear here once the Stripe secret key and the three test Price IDs are added to the hosting environment.
      </p>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3">
        {!hasStripeSubscription ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleAction("/api/billing/checkout")}
            className="interactive-contrast rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Opening checkout…" : "Subscribe — $3,000/year"}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                handleAction(
                  "/api/billing/seat-packs",
                  `Add one five-seat pack (${nextSeatPackPrice}) to this organization? Stripe will prorate the annual subscription and charge the saved payment method.`,
                )
              }
              className="interactive-contrast rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Updating seats…" : `Add 5 seats — ${nextSeatPackPrice}`}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleAction("/api/billing/portal")}
              className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Manage payment & invoices
            </button>
          </>
        )}
      </div>
      {message ? <p className="mt-4 text-sm leading-6 text-slate-700">{message}</p> : null}
    </div>
  );
}
