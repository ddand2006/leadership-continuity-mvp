const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function setup({ previous = false, scheduled = true, fail = false, email = 'billing@example.com' } = {}) {
  const sent = [];
  const event = { id: 'evt_cancel', type: 'customer.subscription.updated', data: {
    previous_attributes: previous === undefined ? {} : { cancel_at_period_end: previous },
    object: { id: 'sub_test', customer: 'cus_test', status: 'active', cancel_at_period_end: scheduled,
      cancel_at: 1821200400, trial_end: null, items: { data: [{ current_period_end: 1821200400, price: { id: 'price_test' } }] } },
  } };
  const query = { select: () => query, update: () => query, eq: () => query,
    maybeSingle: async () => ({ data: { name: 'Miller <Enterprises>', billing_contact_email: email } }) };
  const imports = {
    '@/lib/coaching/commerce-provider': { handleCoachingStripeEvent: async () => false },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/env': { hasResendEnv: () => true },
    '@/lib/resend': { sendResendEmail: async message => { sent.push(message); if (fail) throw new Error('Email unavailable'); } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => ({ from: () => query }) },
    '@/lib/stripe-billing': { countSeatPacks: () => 0, getOrganizationIdFromStripeSubscription: () => 'org_test',
      getStripe: () => ({ webhooks: { constructEvent: () => event }, customers: { retrieve: async () => ({ email: 'stripe@example.com' }) } }) },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('src/app/api/stripe/webhook/route.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => imports[name] || require(name), mod, mod.exports);
  return { sent, run: () => mod.exports.POST({ headers: { get: () => 'signature' }, text: async () => '' }) };
}
process.env.STRIPE_SECRET_KEY = 'test-placeholder';
process.env.STRIPE_WEBHOOK_SECRET = 'test-placeholder';
test('scheduled cancellation emails billing contact with date and safe HTML', async () => {
  const t = setup(); assert.equal((await t.run()).status, 200);
  assert.equal(t.sent[0].to, 'billing@example.com');
  assert.match(t.sent[0].text, /September 17, 2027/);
  assert.match(t.sent[0].text, /will not renew/);
  assert.match(t.sent[0].html, /Miller &lt;Enterprises&gt;/);
});
test('unrelated updates and resumed subscriptions do not send cancellation emails', async () => {
  for (const options of [{ previous: true }, { scheduled: false }]) {
    const t = setup(options); assert.equal((await t.run()).status, 200); assert.equal(t.sent.length, 0);
  }
});
test('delivery failure asks Stripe to retry with the same idempotency key', async () => {
  const t = setup({ fail: true });
  assert.equal((await t.run()).status, 500); assert.equal((await t.run()).status, 500);
  assert.equal(t.sent[0].idempotencyKey, t.sent[1].idempotencyKey);
});
test('missing billing email falls back to Stripe customer email', async () => {
  const t = setup({ email: null }); assert.equal((await t.run()).status, 200);
  assert.equal(t.sent[0].to, 'stripe@example.com');
});
