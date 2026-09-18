import Stripe from "stripe";
export function getAffiliateStripe(sandbox: boolean) {
 const name = sandbox ? "STRIPE_AFFILIATE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY";
 const key = process.env[name]?.trim();
 const pattern = sandbox ? /^(sk|rk)_test_/ : /^(sk|rk)_live_/;
 if (!key || !pattern.test(key)) throw new Error(sandbox
  ? "Affiliate sandbox is not configured. Save a sandbox-only STRIPE_AFFILIATE_TEST_SECRET_KEY; live billing stays unchanged."
  : "Live affiliate Stripe requires a live key. Test credentials cannot be used here.");
 return new Stripe(key);
}
