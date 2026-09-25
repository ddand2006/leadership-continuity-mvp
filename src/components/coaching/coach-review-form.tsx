'use client';
import { useActionState } from 'react';
import { reviewCoachPortal } from '@/lib/coaching/actions';
export function CoachReviewForm({ coachId, decision, label }: { coachId: string; decision: string; label: string }) {
    const [state, action, pending] = useActionState(reviewCoachPortal, {} as { error?: string; success?: string });
    return <form action={action} className="inline-flex items-center gap-2"><input type="hidden" name="coach_id" value={coachId}/><input type="hidden" name="decision" value={decision}/>{decision.startsWith('reject') && <input name="note" required placeholder="Reason for rejection" className="w-44 rounded-lg border p-1 text-xs"/>}<button disabled={pending} className="rounded-full bg-teal-950 px-3 py-1 text-xs font-semibold text-white">{pending ? 'Saving…' : label}</button>{state.error && <span className="text-xs text-red-700">{state.error}</span>}{state.success && <span className="text-xs text-teal-800">Saved</span>}</form>;
}
