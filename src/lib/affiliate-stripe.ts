import Stripe from "stripe";
import { affiliatePaymentsLive } from "@/lib/affiliate-payment-mode";
export function getAffiliateStripe(sandbox: boolean) {
 const name = sandbox ? "STRIPE_AFFILIATE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY";
 const key = process.env[name]?.trim();
 const live = sandbox ? false : affiliatePaymentsLive();
 const pattern = live ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/;
 if (!key || !pattern.test(key)) throw new Error(sandbox
  ? "Affiliate sandbox is not configured. Save a sandbox-only STRIPE_AFFILIATE_TEST_SECRET_KEY; live billing stays unchanged."
  : live ? "Live affiliate Stripe requires a live key. Test credentials cannot be used here."
  : "Affiliate staging requires a test-only STRIPE_SECRET_KEY.");
 return new Stripe(key);
}
