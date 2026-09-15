import 'server-only';
import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {canUsePlatformPreview} from './model';

export async function requirePlatformPreviewAdministrator() {
  const user=await requireUser();
  const db=await createSupabaseServerClient();
  const {data:profile,error}=await db.from('profiles').select('role,deleted_at').eq('auth_user_id',user.id).is('deleted_at',null).maybeSingle();
  if(error)throw new Error('Unable to verify platform preview access.');
  if(!canUsePlatformPreview(profile,user.email))notFound();
  return user;
}
