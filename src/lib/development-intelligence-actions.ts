'use server';
import { revalidatePath } from 'next/cache';
import { coachingContext } from '@/lib/coaching/server';
import { deliverCoachingNotifications } from '@/lib/coaching/notifications';
export type DevelopmentResult = {
    error?: string;
    success?: string;
    redirectTo?: string;
};
export async function mutateDevelopment(_previous: DevelopmentResult, form: FormData): Promise<DevelopmentResult> {
    try {
        const { db, user } = await coachingContext();
        const operation = String(form.get('operation') ?? '');
        const payload: Record<string, unknown> = {};
        for (const [k, v] of form.entries()) {
            if (k === 'operation' || k.startsWith('$ACTION_') || typeof v !== 'string')
                continue;
            if (v.length > 20000)
                throw Error('Entry too long');
            payload[k] = k === 'evidence_ids' ? form.getAll(k) : v;
        }
        for (const key of ['matching_weights', 'evidence_weights'])
            if (payload[key])
                payload[key] = JSON.parse(String(payload[key]));
        const { data, error } = operation === 'analyze' ? await db.rpc('development_intelligence_analyze', { candidate: payload.candidate_id }) : await db.rpc('development_intelligence_mutate', { operation, payload });
        if (error)
            throw Error(error.message);
        revalidatePath('/candidates', 'layout');
        revalidatePath('/coaching', 'layout');
        revalidatePath('/dashboard', 'layout');
        revalidatePath('/admin/coaching', 'layout');
        try {
            await deliverCoachingNotifications(user.id);
        }
        catch {
            console.warn('Development notification delivery deferred');
        }
        return { success: operation === 'analyze' ? `${data} new development needs identified. Review recommendations before acting.` : 'Saved.', redirectTo: operation === 'coaching_request' ? `/coaching/request?edit=${data}` : undefined };
    }
    catch (e) {
        return { error: e instanceof Error ? e.message : 'Unable to save development update' };
    }
}
