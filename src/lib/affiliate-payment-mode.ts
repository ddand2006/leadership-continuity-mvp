const productionProjectRef = "hnrwovfgttenymnhowsf";

// The ordinary ledger stays live-only unless an isolated Hostinger rehearsal is explicit.
export function affiliatePaymentsLive(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = env.AFFILIATE_PAYMENT_MODE ?? "live";
  if (mode === "live") return true;
  if (mode !== "staging") throw new Error("Unknown affiliate payment mode.");

  const ref = env.AFFILIATE_STAGING_PROJECT_REF;
  if (!ref || !/^[a-z]{20}$/.test(ref) || ref === productionProjectRef) {
    throw new Error("Affiliate staging requires a separate Supabase project.");
  }
  const app = new URL(env.APP_URL ?? "");
  const database = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (app.protocol !== "https:" || !app.hostname.endsWith(".hostingersite.com") ||
      app.username || app.password || app.port ||
      database.href !== `https://${ref}.supabase.co/`) {
    throw new Error("Affiliate staging must use a temporary Hostinger app and its declared Supabase project.");
  }
  return false;
}

export function assertAffiliatePaymentMode(livemode: boolean) {
  if (livemode !== affiliatePaymentsLive()) {
    throw new Error("Stripe record does not match this app's affiliate payment mode.");
  }
}
