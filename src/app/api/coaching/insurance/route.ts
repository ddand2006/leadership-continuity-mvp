import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const meta = z.object({ insurer: z.string().trim().min(2).max(200), policy_number: z.string().trim().min(2).max(200), coverage_type: z.string().trim().min(2).max(100), coverage_amount: z.string().max(30).optional(), effective_date: z.string().date(), expiration_date: z.string().date() });
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.formData();
    const file = body.get('certificate');
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a certificate file.' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Certificate must be 10 MB or smaller.' }, { status: 400 });
    if (!['application/pdf','image/png','image/jpeg'].includes(file.type)) return NextResponse.json({ error: 'Upload a PDF, PNG, or JPG certificate.' }, { status: 400 });
    const parsed = meta.safeParse(Object.fromEntries([...body.entries()].filter(([key]) => key !== 'certificate')));
    if (!parsed.success) return NextResponse.json({ error: 'Enter insurer, policy, coverage, and valid dates.' }, { status: 400 });
    const db = createSupabaseServerClient();
    const { data: coach, error: coachError } = await (await db).from('coach_profiles').select('id').eq('user_id', user.id).single();
    if (coachError || !coach) return NextResponse.json({ error: 'Coach profile not found.' }, { status: 404 });
    const admin = createSupabaseAdminClient();
    const bucket = 'coach-compliance-documents';
    const path = `${coach.id}/insurance/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploaded = await admin.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) return NextResponse.json({ error: 'Certificate could not be stored securely.' }, { status: 500 });
    const saved = await (await db).rpc('coach_portal_add_insurance', { payload: { ...parsed.data, certificate_bucket: bucket, certificate_path: path } });
    if (saved.error) { await admin.storage.from(bucket).remove([path]); return NextResponse.json({ error: saved.error.message }, { status: 400 }); }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unable to submit insurance certificate.' }, { status: 500 }); }
}
