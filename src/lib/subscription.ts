const SUBSCRIPTION_COLUMNS =
  "subscription_status, subscription_tier, trial_ends_at, billing_contact_email, leadership_continuity_enabled, leadership_continuity_tier, leadership_help_enabled, leadership_help_tier";
const BILLING_SUPPORT_EMAIL = "billing@leadershipcontinuitysystem.com";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_PRODUCTS = [
  "leadership_continuity",
  "leadership_help",
] as const;

export type SubscriptionProduct = (typeof SUBSCRIPTION_PRODUCTS)[number];

export function isPaywallEnabled() {
  return process.env.LCS_PAYWALL_ENABLED === "true";
}

export const ORGANIZATION_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
] as const;

export type OrganizationSubscriptionStatus =
  (typeof ORGANIZATION_SUBSCRIPTION_STATUSES)[number];

type OrganizationSubscriptionLookup = {
  billing_contact_email: string | null;
  leadership_continuity_enabled: boolean | null;
  leadership_continuity_tier: string | null;
  leadership_help_enabled: boolean | null;
  leadership_help_tier: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  trial_ends_at: string | null;
};

type OrganizationSubscriptionLookupResult = {
  data: OrganizationSubscriptionLookup | null;
  error: { message: string } | null;
};

export type OrganizationSubscriptionClient = {
  from: (table: "organizations") => {
    select: (columns: string) => {
      eq: (column: "id", value: string) => {
        maybeSingle: () => PromiseLike<OrganizationSubscriptionLookupResult>;
      };
    };
  };
};

export type OrganizationSubscriptionState = {
  billingContactEmail: string;
  daysRemaining: number;
  hasAccess: boolean;
  products: Record<
    SubscriptionProduct,
    {
      enabled: boolean;
      tier: string;
    }
  >;
  isLegacyFallback: boolean;
  isTrialActive: boolean;
  status: OrganizationSubscriptionStatus;
  tier: string;
  trialEndsAt: string | null;
};

function normalizeSubscriptionStatus(value: string | null | undefined) {
  if (!value) {
    return "canceled" satisfies OrganizationSubscriptionStatus;
  }

  return ORGANIZATION_SUBSCRIPTION_STATUSES.includes(
    value as OrganizationSubscriptionStatus,
  )
    ? (value as OrganizationSubscriptionStatus)
    : ("canceled" satisfies OrganizationSubscriptionStatus);
}

export function isMissingOrganizationBillingColumnError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const combinedMessage = error.message.toLowerCase();

  return (
    combinedMessage.includes("subscription_status") ||
    combinedMessage.includes("subscription_tier") ||
    combinedMessage.includes("trial_ends_at") ||
    combinedMessage.includes("billing_contact_email") ||
    combinedMessage.includes("leadership_continuity_enabled") ||
    combinedMessage.includes("leadership_continuity_tier") ||
    combinedMessage.includes("leadership_help_enabled") ||
    combinedMessage.includes("leadership_help_tier")
  );
}

export function hasProductAccess(
  subscription: OrganizationSubscriptionState,
  product: SubscriptionProduct,
) {
  return subscription.products[product].enabled;
}

export function getProductTier(
  subscription: OrganizationSubscriptionState,
  product: SubscriptionProduct,
) {
  return subscription.products[product].tier;
}

export function formatSubscriptionProductLabel(product: SubscriptionProduct) {
  switch (product) {
    case "leadership_continuity":
      return "Leadership Continuity";
    case "leadership_help":
      return "Leadership Help";
    default:
      return "Product";
  }
}

export function resolveOrganizationSubscriptionLookup(
  result: OrganizationSubscriptionLookupResult,
): OrganizationSubscriptionState {
  if (!isPaywallEnabled()) {
    return {
      billingContactEmail: BILLING_SUPPORT_EMAIL,
      daysRemaining: 0,
      hasAccess: true,
      products: {
        leadership_continuity: {
          enabled: true,
          tier: "organization",
        },
        leadership_help: {
          enabled: true,
          tier: "organization",
        },
      },
      isLegacyFallback: true,
      isTrialActive: false,
      status: "active",
      tier: "organization",
      trialEndsAt: null,
    };
  }

  if (result.error) {
    const billingError = new Error(result.error.message);

    if (isMissingOrganizationBillingColumnError(billingError)) {
      return {
        billingContactEmail: BILLING_SUPPORT_EMAIL,
        daysRemaining: 0,
        hasAccess: true,
        products: {
          leadership_continuity: {
            enabled: true,
            tier: "organization",
          },
          leadership_help: {
            enabled: true,
            tier: "organization",
          },
        },
        isLegacyFallback: true,
        isTrialActive: false,
        status: "active",
        tier: "organization",
        trialEndsAt: null,
      };
    }

    throw billingError;
  }

  if (!result.data) {
    throw new Error("Organization subscription could not be loaded.");
  }

  const status = normalizeSubscriptionStatus(result.data.subscription_status);
  const trialEndsAt = result.data.trial_ends_at;
  const trialEndsAtTimestamp = trialEndsAt ? Date.parse(trialEndsAt) : Number.NaN;
  const now = Date.now();
  const isTrialActive =
    status === "trialing" &&
    Number.isFinite(trialEndsAtTimestamp) &&
    trialEndsAtTimestamp >= now;
  const continuityEnabled =
    (status === "active" || isTrialActive) &&
    Boolean(result.data.leadership_continuity_enabled);
  const leadershipHelpEnabled =
    (status === "active" || isTrialActive) &&
    Boolean(result.data.leadership_help_enabled);

  return {
    billingContactEmail:
      result.data.billing_contact_email?.trim() || BILLING_SUPPORT_EMAIL,
    daysRemaining: isTrialActive
      ? Math.max(0, Math.ceil((trialEndsAtTimestamp - now) / MS_PER_DAY))
      : 0,
    hasAccess: continuityEnabled || leadershipHelpEnabled,
    products: {
      leadership_continuity: {
        enabled: continuityEnabled,
        tier:
          result.data.leadership_continuity_tier?.trim() ||
          result.data.subscription_tier?.trim() ||
          "organization",
      },
      leadership_help: {
        enabled: leadershipHelpEnabled,
        tier: result.data.leadership_help_tier?.trim() || "none",
      },
    },
    isLegacyFallback: false,
    isTrialActive,
    status,
    tier: result.data.subscription_tier?.trim() || "organization",
    trialEndsAt,
  };
}

export async function loadOrganizationSubscription(
  client: OrganizationSubscriptionClient,
  organizationId: string,
) {
  const result = await client
    .from("organizations")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("id", organizationId)
    .maybeSingle();

  return resolveOrganizationSubscriptionLookup(result);
}

export function formatOrganizationSubscriptionLabel(
  subscription: OrganizationSubscriptionState,
) {
  if (subscription.isLegacyFallback) {
    return "Legacy access";
  }

  switch (subscription.status) {
    case "active":
      return "Active subscription";
    case "trialing":
      return subscription.isTrialActive ? "Trial active" : "Trial ended";
    case "past_due":
      return "Payment required";
    case "canceled":
      return "Subscription inactive";
    default:
      return "Subscription";
  }
}

export function formatOrganizationTrialEndDate(trialEndsAt: string | null) {
  if (!trialEndsAt) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(trialEndsAt));
}
