import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: Promise<{ coachId: string }> }) {
  try {
    const user = await requireUser();
    const auth = await createSupabaseServerClient();
    const { data: profile } = await auth.from('profiles').select('role').eq('auth_user_id', user.id).maybeSingle();
    if (profile?.role !== 'system_admin') return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
    const { coachId } = await params;
    const admin = createSupabaseAdminClient();
    const { data: insurance, error } = await admin.from('coach_insurance').select('certificate_bucket,certificate_path,insurer,expiration_date').eq('coach_id', coachId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error || !insurance) return NextResponse.json({ error: 'Certificate not found.' }, { status: 404 });
    const signed = await admin.storage.from(insurance.certificate_bucket).createSignedUrl(insurance.certificate_path, 300);
    if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: 'Certificate link unavailable.' }, { status: 500 });
    return NextResponse.json({ url: signed.data.signedUrl, expiresIn: 300, insurer: insurance.insurer, expirationDate: insurance.expiration_date });
  } catch { return NextResponse.json({ error: 'Unable to open certificate.' }, { status: 500 }); }
}
