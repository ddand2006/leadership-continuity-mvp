import Stripe from "stripe";
import { getAppUrl } from "@/lib/env";

const configuredPriceIds = (process.env.STRIPE_PRICE_IDS ?? "")
  .split(",")
  .map((priceId) => priceId.trim())
  .filter(Boolean);

// STRIPE_PRICE_IDS is the compact production setting. The individual values
// remain supported so existing deployments continue working during migration.
export const FOUNDATION_STRIPE_PRICE_ID =
  configuredPriceIds[0] ?? process.env.STRIPE_FOUNDATION_ANNUAL_PRICE_ID;
export const FIRST_SEAT_PACK_STRIPE_PRICE_ID =
  configuredPriceIds[1] ?? process.env.STRIPE_FIRST_SEAT_PACK_ANNUAL_PRICE_ID;
export const VOLUME_SEAT_PACK_STRIPE_PRICE_ID =
  configuredPriceIds[2] ?? process.env.STRIPE_VOLUME_SEAT_PACK_ANNUAL_PRICE_ID;

export function hasStripeBillingConfiguration() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      FOUNDATION_STRIPE_PRICE_ID &&
      FIRST_SEAT_PACK_STRIPE_PRICE_ID &&
      VOLUME_SEAT_PACK_STRIPE_PRICE_ID,
  );
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Stripe billing is not configured yet.");
  }

  return new Stripe(secretKey);
}

export function getStripeBillingReturnUrl(path: string) {
  return new URL(path, getAppUrl()).toString();
}

export function getSeatPackPriceId(existingSeatPacks: number) {
  const priceId =
    existingSeatPacks === 0
      ? FIRST_SEAT_PACK_STRIPE_PRICE_ID
      : VOLUME_SEAT_PACK_STRIPE_PRICE_ID;

  if (!priceId) {
    throw new Error("Stripe seat-pack pricing is not configured yet.");
  }

  return priceId;
}

export function countSeatPacks(subscription: Stripe.Subscription) {
  const seatPackPriceIds = new Set(
    [
      FIRST_SEAT_PACK_STRIPE_PRICE_ID,
      VOLUME_SEAT_PACK_STRIPE_PRICE_ID,
    ].filter((priceId): priceId is string => Boolean(priceId)),
  );

  return subscription.items.data.reduce((total, item) => {
    return seatPackPriceIds.has(item.price.id) ? total + (item.quantity ?? 0) : total;
  }, 0);
}

export function getOrganizationIdFromStripeSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata.organization_id?.trim() || null;
}
