const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function setup({ organizationId = 'private-org', coupon = {}, total = 0, affiliateId }  = {}) {
  const calls = [];
  class ApiRouteError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  const stripe = {
    coupons: { retrieve: async id => {
      calls.push({ coupon: id });
      return { valid: true, percent_off: 100, duration: 'forever', max_redemptions: 1, ...coupon };
    } },
    checkout: { sessions: {
      create: async params => {
        calls.push({ checkout: params });
        return { id: 'cs_verification', url: 'https://checkout.stripe.com/example', amount_total: total };
      },
      expire: async id => { calls.push({ expired: id }); },
    } },
  };
  const imports = {
    'next/server': { NextResponse: { json: body => ({ status: 200, body }) } },
    '@/lib/api-route': {
      ApiRouteError,
      createApiErrorResponse: error => ({ status: error.status || 500, body: { error: error.message } }),
      requireApiWorkspaceProfile: async () => ({
        user: { email: 'verification@example.com' }, profile: { organization_id: organizationId },
        admin: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { affiliate_id: affiliateId }, error: null }) }) }) }) },
      }),
    },
    '@/lib/stripe-billing': {
      FOUNDATION_STRIPE_PRICE_ID: 'foundation', FIRST_SEAT_PACK_STRIPE_PRICE_ID: 'first',
      VOLUME_SEAT_PACK_STRIPE_PRICE_ID: 'volume', getStripe: () => stripe,
      hasStripeBillingConfiguration: () => true, getStripeBillingReturnUrl: path => 'https://example.com' + path,
    },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(
    fs.readFileSync('src/app/api/billing/checkout/route.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText)(name => imports[name] || require(name), mod, mod.exports);
  return { calls, run: body => mod.exports.POST({ json: async () => body || {} }) };
}

process.env.STRIPE_VERIFICATION_ORGANIZATION_ID = 'private-org';
process.env.STRIPE_VERIFICATION_COUPON_ID = 'private-coupon';

test('private workspace receives full recurring discount without requiring a card', async () => {
  const t = setup();
  assert.equal((await t.run({ additionalSeatPacks: 2 })).status, 200);
  const checkout = t.calls.find(c => c.checkout).checkout;
  assert.deepEqual(checkout.discounts, [{ coupon: 'private-coupon' }]);
  assert.equal(checkout.payment_method_collection, 'if_required');
  assert.equal(checkout.subscription_data.metadata.organization_id, 'private-org');
  assert.equal(checkout.line_items.length, 3);
});

test('other workspaces cannot request the private discount through client data', async () => {
  const t = setup({ organizationId: 'paying-org', total: 300000 });
  assert.equal((await t.run({ coupon: 'private-coupon', organization_id: 'private-org' })).status, 200);
  assert.equal(t.calls.some(c => c.coupon), false);
  assert.equal(t.calls[0].checkout.discounts, undefined);
  assert.equal(t.calls[0].checkout.payment_method_collection, undefined);
});

test('unsafe or exhausted coupons fail before creating checkout', async () => {
  for (const coupon of [
    { valid: false }, { percent_off: 99 }, { duration: 'once' },
    { applies_to: { products: ['foundation'] } }, { max_redemptions: null },
  ]) {
    const t = setup({ coupon });
    assert.equal((await t.run()).status, 503);
    assert.equal(t.calls.some(c => c.checkout), false);
  }
});

test('a nonzero or unknown verification total expires the session and never returns its URL', async () => {
  for (const total of [100, null]) {
    const t = setup({ total });
    const response = await t.run();
    assert.equal(response.status, 502);
    assert.equal(response.body.url, undefined);
    assert.ok(t.calls.some(c => c.expired === 'cs_verification'));
  }
});

 test('checkout uses only the stored affiliate for session and renewal metadata', async () => {
  const t = setup({ organizationId: 'paying-org', total: 300000, affiliateId: 'trusted-affiliate' });
  assert.equal((await t.run({ affiliate_id: 'spoofed-affiliate' })).status, 200);
  const checkout = t.calls.find(c => c.checkout).checkout;
  assert.equal(checkout.metadata.affiliate_id, 'trusted-affiliate');
  assert.equal(checkout.subscription_data.metadata.affiliate_id, 'trusted-affiliate');
  assert.equal(checkout.subscription_data.transfer_data, undefined);
});
