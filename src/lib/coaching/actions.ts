'use server';
import { deliverCoachingNotifications } from './notifications';
import { revalidatePath } from 'next/cache';
import { coachingContext } from './server';
export async function mutateCoaching(_previous: {
    error?: string;
    success?: string;
    redirectTo?: string;
}, form: FormData): Promise<{
    error?: string;
    success?: string;
    redirectTo?: string;
}> {
    try {
        const { db,user } = await coachingContext();
        const operation = String(form.get('operation') ?? '');
        const payload: Record<string, unknown> = {};
        for (const [key, value] of form.entries()) {
            if (key === 'operation' || key.startsWith('$ACTION_') || typeof value !== 'string')
                continue;
            if (value.length > 20000)
                return { error: 'Please shorten this entry to 20,000 characters.' };
            if (key.endsWith('_ids') || ['objectives','context_categories'].includes(key))
                payload[key] = form.getAll(key);
            else if (key === 'languages')
                payload[key] = value.split(',').map(v => v.trim()).filter(Boolean);
            else
                payload[key] = value;
        }
        for (const key of ['specialty_ids', 'industry_ids', 'leadership_level_ids'])
            if (operation === 'save_profile' && !payload[key])
                payload[key] = [];
        if(operation==='weights') payload.weights=Object.fromEntries(Object.entries(payload).filter(([key])=>key.startsWith('weight_')).map(([key,value])=>[key.slice(7),Number(value)]));
        const { data, error } = await db.rpc('coaching_mutate', { operation, payload });
        if (error)
            return { error: error.message };
        try{await deliverCoachingNotifications(user.id);}catch{console.warn('Coaching email delivery deferred.');}
        let redirectTo: string | undefined;
        if(operation==='request_save' && payload.submit==='true'){
            const matched=await db.rpc('coaching_run_matching',{rid:data});
            if(matched.error)return {error:'Request saved. Matching could not complete; open Coaching Requests to retry.'};
            redirectTo=`/coaching/request/${data}/matches`;
        }
        if(operation==='request_save'&&payload.submit!=='true')redirectTo='/coaching/requests';
        if(operation==='setup_engagement')redirectTo=`/coaching/clients/${data}`;
        revalidatePath('/coaching', 'layout');
        revalidatePath('/admin/coaching', 'layout');
        return { redirectTo, success: operation === 'opt_in' ? 'Coaching access requested. A Leader Continuity representative will follow up with your organization.' : 'Saved.' };
    }
    catch {
        return { error: 'Unable to save. Check your session and try again.' };
    }
}
