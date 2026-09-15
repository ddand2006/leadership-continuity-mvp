'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { coachingContext } from './server';
import { coachingCheckout, coachingConnect, coachingPayout, coachingRefund, provider } from './commerce-provider';
import { deliverCoachingNotifications } from './notifications';
export type CommerceResult = {
    error?: string;
    success?: string;
    redirectTo?: string;
};
export async function mutateCommerce(_previous: CommerceResult, form: FormData): Promise<CommerceResult> {
    try {
        const ctx = await coachingContext();
        const operation = String(form.get('operation') ?? '');
        const payload: Record<string, unknown> = {};
        for (const [key, value] of form.entries()) {
            if (key === 'operation' || key.startsWith('$ACTION_') || typeof value !== 'string')
                continue;
            if (value.length > 20000)
                throw new Error('Entry too long');
            payload[key] = value;
        }
        for (const key of ['cancellation_terms', 'installments'])
            if (typeof payload[key] === 'string' && payload[key])
                payload[key] = JSON.parse(payload[key] as string);
        if (operation === 'agreement_accept' || operation === 'coach_accept') {
            const h = await headers();
            payload.user_agent = h.get('user-agent');
            // IP is only reliable behind a configured trusted reverse proxy; never accept it from form fields.
            payload.ip = process.env.COACHING_TRUST_PROXY === 'true' ? h.get('x-forwarded-for')?.split(',')[0]?.trim() : null;
        }
        let redirectTo: string | undefined;
        if (operation === 'connect') {
            if (!ctx.coach)
                throw new Error('Coach account required');
            redirectTo = await coachingConnect(ctx.coach.id);
        }
        else if (['payout_send', 'refund_send', 'manual_refund'].includes(operation)) {
            const permitted = await ctx.db.rpc('coaching_commerce_read', { section: 'admin' });
            if (permitted.error)
                throw new Error('Platform administrator required');
            if (operation === 'payout_send')
                await coachingPayout(String(payload.id));
            if (operation === 'refund_send')
                await coachingRefund(String(payload.id));
            if (operation === 'manual_refund')
                await provider('manual_refund', { id: payload.id, reference: payload.reference });
        }
        else {
            const { data, error } = await ctx.db.rpc('coaching_commerce_mutate', { operation: operation === 'checkout' ? 'payment_prepare' : operation, payload });
            if (error)
                throw new Error(error.message);
            if (operation === 'checkout')
                redirectTo = await coachingCheckout(String(data));
            if(['agreement_accept','coach_accept'].includes(operation)&&(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)) {
              await provider('attestation_context',{id:payload.id,actor:ctx.user.id,kind:operation==='coach_accept'?'coach':'organization',ip:payload.ip,user_agent:payload.user_agent});
            }

        }
        revalidatePath('/coaching', 'layout');
        revalidatePath('/admin/coaching', 'layout');
        try {
            await deliverCoachingNotifications(ctx.user.id);
        }
        catch {
            console.warn('Commerce email delivery deferred.');
        }
        return { success: 'Saved.', redirectTo };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : 'Unable to save commerce changes.' };
    }
}
