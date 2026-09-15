import {notFound} from 'next/navigation';
import {canAccessCoachingPreview} from './preview';
import 'server-only';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
// Deliberately never use the support-mode/service-role workspace client here.
export async function coachingContext() {
    const user = await requireUser();
    if (!canAccessCoachingPreview(user)) notFound();
    const db = await createSupabaseServerClient();
    const [profile, coach] = await Promise.all([
        db.from('profiles').select('id,organization_id,role,full_name').eq('auth_user_id', user.id).is('deleted_at', null).maybeSingle(),
        db.from('coach_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    if (profile.error)
        throw new Error(profile.error.message);
    if (coach.error)
        throw new Error(coach.error.message);
    const active = profile.data ? await db.rpc('coaching_enabled', { org: profile.data.organization_id }) : { data: false, error: null };
    if (active.error)
        throw new Error(active.error.message);
    return { user, db, profile: profile.data, coach: coach.data, active: Boolean(active.data),
        admin: ['system_admin', 'hospital_admin'].includes(profile.data?.role ?? ''), platformAdmin: profile.data?.role === 'system_admin' };
}
export async function rpc<T>(db: Awaited<ReturnType<typeof coachingContext>>['db'], name: string, args = {}): Promise<T> {
    const { data, error } = await db.rpc(name, args);
    if (error)
        throw new Error(error.message);
    return data as T;
}
