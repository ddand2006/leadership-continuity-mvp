'use server';
import { coachingContext } from './server';
import { revalidatePath } from 'next/cache';
export type ScaleResult = {
    error?: string;
    success?: string;
    redirectTo?: string;
};
export async function mutateScale(_previous: ScaleResult, form: FormData): Promise<ScaleResult> { try {
    const { db } = await coachingContext();
    const operation = String(form.get('operation'));
    const payload: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
        if (key === 'operation' || key.startsWith('$ACTION_') || typeof value !== 'string')
            continue;
        if (value.length > 20000)
            throw Error('Entry too long');
        payload[key] = value;
    }
    for (const key of ['requirements', 'categories', 'filters'])
        if (payload[key])
            payload[key] = JSON.parse(String(payload[key]));
    if (payload.category) payload.categories = [payload.category];
        const call = operation === 'refresh' ? db.rpc('coaching_scale_refresh', { filters: payload.filters ?? {} }) : operation === 'daily' ? db.rpc('coaching_scale_run_daily') : db.rpc('coaching_scale_mutate', { operation, payload });
    const { data, error } = await call;
    if (error)
        throw Error(error.message);
    revalidatePath('/coaching', 'layout');
    revalidatePath('/admin/coaching', 'layout');
    return { success: operation === 'refresh' || operation === 'daily' ? 'Metrics refreshed.' : 'Saved.', redirectTo: operation === 'renewal' ? `/coaching/request?edit=${data}` : undefined };
}
catch (e) {
    return { error: e instanceof Error ? e.message : 'Unable to save' };
} }
