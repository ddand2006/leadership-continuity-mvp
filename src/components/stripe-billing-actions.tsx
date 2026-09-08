"use client";

import { useState } from "react";

type StripeBillingActionsProps = {
  additionalSeatPacks: number;
  canManageBilling: boolean;
  foundationAnnualPrice: number;
  hasStripeSubscription: boolean;
  includedSeats: number;
  firstSeatPackAnnualPrice: number;
  stripeConfigured: boolean;
  volumeSeatPackAnnualPrice: number;
};

async function startBillingAction(endpoint: string, body?: unknown) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
  foundationAnnualPrice,
  hasStripeSubscription,
  includedSeats,
  firstSeatPackAnnualPrice,
  stripeConfigured,
  volumeSeatPackAnnualPrice,
}: StripeBillingActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [cancellationScheduled, setCancellationScheduled] = useState(false);
  const [requestedSeats, setRequestedSeats] = useState(includedSeats);

  if (!canManageBilling) {
    return null;
  }

  const nextSeatPackPrice = additionalSeatPacks === 0 ? "$1,350/year" : "$1,150/year";
  const selectedSeatCount = Math.max(includedSeats, Math.round(requestedSeats) || includedSeats);
  const selectedSeatPacks = Math.ceil(
    Math.max(0, selectedSeatCount - includedSeats) / 5,
  );
  const selectedAnnualPrice =
    foundationAnnualPrice +
    (selectedSeatPacks === 0
      ? 0
      : firstSeatPackAnnualPrice +
        Math.max(0, selectedSeatPacks - 1) * volumeSeatPackAnnualPrice);

  async function handleAction(endpoint: string, confirmation?: string, body?: unknown) {
    if (confirmation && !window.confirm(confirmation)) {
      return false;
    }

    setIsPending(true);
    setMessage(null);
    try {
      const nextMessage = await startBillingAction(endpoint, body);
      if (nextMessage) {
        setMessage(nextMessage);
      }
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update billing.");
      return false;
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
          <div className="w-full max-w-2xl rounded-[1.5rem] border border-sky-200 bg-sky-50/80 p-5">
            <p className="text-sm font-semibold text-slate-950">Choose your organization capacity</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Foundation includes {includedSeats} internal users. Add capacity in five-person packs as your organization grows.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase">
                  People in the system
                </span>
                <input
                  type="number"
                  min={includedSeats}
                  max={includedSeats + 200 * 5}
                  step={1}
                  value={requestedSeats}
                  onChange={(event) => setRequestedSeats(Number(event.target.value))}
                  className="w-40 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
                />
              </label>
              <p className="pb-3 text-sm text-slate-700">
                {selectedSeatPacks > 0
                  ? `${selectedSeatPacks * 5} additional seats included`
                  : `${includedSeats} seats included`}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  handleAction(
                    "/api/billing/checkout",
                    undefined,
                    { additionalSeatPacks: selectedSeatPacks },
                  )
                }
                className="interactive-contrast rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending
                  ? "Opening checkout…"
                  : `Subscribe — $${selectedAnnualPrice.toLocaleString()}/year`}
              </button>
              <span className="text-sm text-slate-600">Secure Stripe checkout</span>
            </div>
          </div>
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
            <button
              type="button"
              disabled={isPending || cancellationScheduled}
              onClick={() => {
                void handleAction(
                  "/api/billing/cancel",
                  "Schedule cancellation at the end of the current annual term? Your team will keep access until that date. At that point, the account will no longer be billed and saved data will remain securely retained until you reactivate the subscription.",
                ).then((wasScheduled) => {
                  if (wasScheduled) setCancellationScheduled(true);
                });
              }}
              className="rounded-full border border-rose-200 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancellationScheduled
                ? "Cancellation scheduled"
                : isPending
                  ? "Scheduling cancellation…"
                  : "Cancel at end of annual term"}
            </button>
          </>
        )}
      </div>
      {message ? <p className="mt-4 text-sm leading-6 text-slate-700">{message}</p> : null}
    </div>
  );
}
