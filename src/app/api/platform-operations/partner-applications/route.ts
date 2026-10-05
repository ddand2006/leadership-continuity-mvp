import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiWorkspaceProfile, ApiRouteError, createApiErrorResponse } from '@/lib/api-route';

const input = z.object({
  id: z.string().uuid(),
  status: z.enum(['approved', 'rejected', 'suspended']),
  reviewNotes: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const { admin, profile, user } = await requireApiWorkspaceProfile({ requirePaid: false });
    if (profile.role !== 'system_admin') throw new ApiRouteError('Only platform administrators can review partner applications.', 403);
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) throw new ApiRouteError('A valid application and decision are required.', 400);
    const { id, status, reviewNotes } = parsed.data;
    const result = await admin.from('partner_applications').update({
      status,
      review_notes: reviewNotes || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id).select('id,status,review_notes,reviewed_at').single();
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json(result.data);
  } catch (error) {
    return createApiErrorResponse(error, 'Unable to review partner application.');
  }
}
