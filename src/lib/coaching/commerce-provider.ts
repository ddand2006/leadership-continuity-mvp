import 'server-only';
import Stripe from 'stripe';
import { getStripe, getStripeBillingReturnUrl } from '@/lib/stripe-billing';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { cents } from './commerce-model';
type ProviderRow = {
    id: string;
    [key: string]: unknown;
};
export async function provider(operation: string, payload: Record<string, unknown>): Promise<ProviderRow> {
    const { data, error } = await createSupabaseAdminClient().rpc('coaching_commerce_provider', { operation, payload });
    if (error)
        throw new Error(error.message);
    if (data?.error)
        throw new Error(data.error);
    return data;
}
function testStripe() {
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))
        throw new Error('Coaching commerce requires a Stripe test-mode key in this release.');
    return getStripe();
}
export async function coachingCheckout(id: string) {
    const stripe = testStripe();
    const p = await provider('payment', { id });
    if (p.stripe_checkout_session_id) {
        const existing = await stripe.checkout.sessions.retrieve(String(p.stripe_checkout_session_id));
        if (existing.status === 'open' && existing.url)
            return existing.url;
        if (existing.status === 'complete')
            throw new Error('Payment submitted. Awaiting verified payment confirmation.');
        await provider('checkout_expired', { id, session_id: existing.id });
        return coachingCheckout(id);
    }
    let customer = p.customer_id as string | undefined;
    if (!customer) {
        // Reuse the organization's existing customer from subscription billing when configured.
        const org = await createSupabaseAdminClient().from('organizations').select('stripe_customer_id').eq('id', p.organization_id).single();
        if (org.error)
            throw new Error(org.error.message);
        customer = org.data?.stripe_customer_id ?? (await stripe.customers.create({ metadata: { organization_id: String(p.organization_id) } }, { idempotencyKey: `coaching-customer-${p.organization_id}` })).id;
        await provider('customer', { organization_id: p.organization_id, customer_id: customer });
    }
    const metadata = { coaching_payment_id: id, domain: 'coaching' };
    const session = await stripe.checkout.sessions.create({ mode: 'payment', customer, client_reference_id: id, metadata,
        payment_intent_data: { metadata }, invoice_creation: { enabled: true, invoice_data: { metadata } },
        line_items: [{ quantity: 1, price_data: { currency: String(p.currency).toLowerCase(), unit_amount: cents(p.amount), product_data: { name: String(p.package_name) } } }],
        success_url: getStripeBillingReturnUrl(`/coaching/checkout/${p.engagement_id}?payment=submitted`), cancel_url: getStripeBillingReturnUrl(`/coaching/checkout/${p.engagement_id}`),
    }, { idempotencyKey: `coaching-checkout-${id}-${p.checkout_attempt}` });
    if (!session.url)
        throw new Error('Stripe did not return a checkout URL.');
    await provider('checkout_saved', { id, session_id: session.id, url: session.url, expires_at: new Date(session.expires_at * 1000).toISOString() });
    return session.url;
}
export async function coachingConnect(coachId: string) {
    const stripe = testStripe();
    const row = await provider('connect', { coach_id: coachId });
    let accountId = row.stripe_connect_account_id as string | undefined;
    if (!accountId) {
        const account = await stripe.accounts.create({ type: 'express', country: 'US', capabilities: { transfers: { requested: true } }, metadata: { coaching_coach_id: coachId } }, { idempotencyKey: `coaching-connect-${coachId}` });
        accountId = account.id;
        await provider('connect_saved', { coach_id: coachId, account_id: accountId });
    }
    const link = await stripe.accountLinks.create({ account: accountId, refresh_url: getStripeBillingReturnUrl('/coaching/earnings?setup=retry'), return_url: getStripeBillingReturnUrl('/coaching/earnings?setup=returned'), type: 'account_onboarding' });
    return link.url;
}
export async function coachingRefund(id: string) {
    const stripe = testStripe();
    const row = await provider('refund', { id });
    if (!row.payment_intent_id)
        throw new Error('This payment requires an external refund and reference.');
    const refund = row.stripe_refund_id ? await stripe.refunds.retrieve(String(row.stripe_refund_id)) : await stripe.refunds.create({ payment_intent: String(row.payment_intent_id), amount: cents(row.amount), metadata: { coaching_refund_id: id } }, { idempotencyKey: `coaching-refund-${id}` });
    await provider('refund_saved', { id, refund_id: refund.id, status: refund.status });
}
export async function coachingPayout(id: string) {
    const stripe = testStripe();
    const row = await provider('payout', { id });
    const transfer = row.stripe_transfer_id ? await stripe.transfers.retrieve(String(row.stripe_transfer_id)) : await stripe.transfers.create({ amount: cents(row.amount), currency: String(row.currency).toLowerCase(), destination: String(row.account_id), metadata: { coaching_payout_id: id } }, { idempotencyKey: `coaching-payout-${id}` });
    await provider('payout_saved', { id, transfer_id: transfer.id });
}
const objectId = (v: string | {
    id: string;
} | null | undefined) => typeof v === 'string' ? v : v?.id;
// Called only after the existing webhook route verifies the raw request signature.
async function processCoachingStripeEvent(event: Stripe.Event): Promise<boolean> {
    const stripe = getStripe();
    const payload: Record<string, unknown> = { event_id: event.id, event_type: event.type };
    if (event.type === 'account.updated') {
        const a = event.data.object;
        Object.assign(payload, { account_id: a.id, charges_enabled: a.charges_enabled, payouts_enabled: a.payouts_enabled, details_submitted: a.details_submitted, account_status: a.payouts_enabled ? 'active' : a.requirements?.disabled_reason ? 'restricted' : a.details_submitted ? 'pending_verification' : 'onboarding' });
    }
    else if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded' || event.type === 'checkout.session.async_payment_failed') {
        const s = event.data.object;
        if (!s.metadata?.coaching_payment_id)
            return false;
        Object.assign(payload, { payment_id: s.metadata.coaching_payment_id, session_id: s.id, payment_intent_id: objectId(s.payment_intent), invoice_id: objectId(s.invoice), amount: (s.amount_total ?? 0) / 100, currency: s.currency, paid: s.payment_status === 'paid', failed: event.type === 'checkout.session.async_payment_failed', paid_at: new Date(event.created * 1000).toISOString() });
    }
    else if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
        const p = event.data.object;
        if (!p.metadata.coaching_payment_id)
            return false;
        Object.assign(payload, { payment_id: p.metadata.coaching_payment_id, payment_intent_id: p.id, amount: p.amount / 100, currency: p.currency, paid: event.type === 'payment_intent.succeeded', failed: event.type === 'payment_intent.payment_failed', paid_at: new Date(event.created * 1000).toISOString() });
    }
    else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
        const i = event.data.object;
        if (!i.metadata?.coaching_payment_id)
            return false;
        Object.assign(payload, { payment_id: i.metadata.coaching_payment_id, invoice_id: i.id, amount: i.total / 100, currency: i.currency, paid: i.status === 'paid', failed: event.type === 'invoice.payment_failed', paid_at: new Date(event.created * 1000).toISOString(), invoice_number: i.number, invoice_url: i.hosted_invoice_url, invoice_pdf_url: i.invoice_pdf });
    }
    else if (event.type === 'refund.created' || event.type === 'refund.updated' || event.type === 'refund.failed') {
        const r = event.data.object;
        Object.assign(payload, { refund_record_id: r.metadata?.coaching_refund_id, payment_intent_id: objectId(r.payment_intent), refund_id: r.id, status: r.status, amount: r.amount / 100 });
    }
    else if (event.type === 'charge.refunded') {
        const c = event.data.object;
        if (!c.metadata.coaching_payment_id)
            return false;
        // Fetch every refund, including those created in the Stripe dashboard; no truncated embedded list.
        for await (const r of stripe.refunds.list({ charge: c.id, limit: 100 })) {
            await provider('event', { event_id: `${event.id}:${r.id}`, event_type: 'refund.updated', refund_record_id: r.metadata?.coaching_refund_id, payment_id:c.metadata.coaching_payment_id, payment_intent_id:objectId(r.payment_intent), refund_id: r.id, status: r.status, amount: r.amount / 100 });
        }
        return true;
    }
    else
        return false;
    if(payload.paid && payload.payment_intent_id){
      const intent=await stripe.paymentIntents.retrieve(String(payload.payment_intent_id),{expand:['latest_charge.balance_transaction']});
      const charge=intent.latest_charge;
      if(charge&&typeof charge!=='string'&&charge.balance_transaction&&typeof charge.balance_transaction!=='string') payload.fee=charge.balance_transaction.fee/100;
    }
    await provider('event', payload);
    return true;
}

export async function handleCoachingStripeEvent(event:Stripe.Event):Promise<boolean>{
 try{return await processCoachingStripeEvent(event);}
 catch(error){try{await provider('event_error',{event_id:event.id,event_type:event.type});}catch{console.error('Unable to record coaching webhook failure');}throw error;}
}
