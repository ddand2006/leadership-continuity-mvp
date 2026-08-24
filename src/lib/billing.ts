import { ApiRouteError } from "@/lib/api-route";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FOUNDATION_INCLUDED_SEATS = 10;
export const SEATS_PER_GROWTH_PACK = 5;
export const FIRST_SEAT_PACK_ANNUAL_PRICE_DOLLARS = 1350;
export const VOLUME_SEAT_PACK_ANNUAL_PRICE_DOLLARS = 1150;

export const FOUNDATION_PLAN = {
  annualPriceDollars: 3000,
  includedSeats: FOUNDATION_INCLUDED_SEATS,
  name: "Foundation",
} as const;

export function getOrganizationSeatLimit(input: {
  included_seats: number | null;
  additional_seat_packs: number | null;
}) {
  return (
    Math.max(0, input.included_seats ?? FOUNDATION_INCLUDED_SEATS) +
    Math.max(0, input.additional_seat_packs ?? 0) * SEATS_PER_GROWTH_PACK
  );
}

export function calculateExpectedAnnualBilling(input: {
  billableSeats: number;
  includedSeats: number | null;
  additionalSeatPacks: number | null;
}) {
  const includedSeats = Math.max(0, input.includedSeats ?? FOUNDATION_INCLUDED_SEATS);
  const requiredSeatPacks = Math.max(
    0,
    Math.ceil(Math.max(0, input.billableSeats - includedSeats) / SEATS_PER_GROWTH_PACK),
  );
  const billedSeatPacks = Math.max(
    requiredSeatPacks,
    Math.max(0, input.additionalSeatPacks ?? 0),
  );
  const seatPackCost =
    billedSeatPacks === 0
      ? 0
      : FIRST_SEAT_PACK_ANNUAL_PRICE_DOLLARS +
        Math.max(0, billedSeatPacks - 1) * VOLUME_SEAT_PACK_ANNUAL_PRICE_DOLLARS;

  return {
    annualBillingDollars: FOUNDATION_PLAN.annualPriceDollars + seatPackCost,
    billedSeatPacks,
  };
}

export function isBillableInternalUserStatus(status: string) {
  return status === "active" || status === "invited";
}

export function areSeatLimitsEnabled() {
  return process.env.LCS_SEAT_LIMITS_ENABLED === "true";
}

export async function assertOrganizationSeatAvailable(options: {
  admin: SupabaseClient;
  organizationId: string;
}) {
  if (!areSeatLimitsEnabled()) {
    return;
  }

  const [organizationResult, usersResult] = await Promise.all([
    options.admin
      .from("organizations")
      .select("included_seats, additional_seat_packs")
      .eq("id", options.organizationId)
      .maybeSingle(),
    options.admin
      .from("organization_users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", options.organizationId)
      .in("status", ["active", "invited"]),
  ]);

  if (organizationResult.error) {
    throw new ApiRouteError(organizationResult.error.message, 500);
  }

  if (!organizationResult.data) {
    throw new ApiRouteError("Organization billing settings could not be found.", 404);
  }

  if (usersResult.error) {
    throw new ApiRouteError(usersResult.error.message, 500);
  }

  const seatLimit = getOrganizationSeatLimit(organizationResult.data);
  const seatsInUse = usersResult.count ?? 0;

  if (seatsInUse >= seatLimit) {
    throw new ApiRouteError(
      `All ${seatLimit} internal seats are in use. Add a five-person seat pack before approving another internal user.`,
      409,
    );
  }
}
