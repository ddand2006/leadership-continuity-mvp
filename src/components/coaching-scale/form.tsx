'use client';
import { useActionState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { mutateScale } from '@/lib/coaching/scale-actions';
export function ScaleForm({ operation, hidden = {}, children, button = 'Save' }: {
    operation: string;
    hidden?: Record<string, string>;
    children?: ReactNode;
    button?: string;
}) { const [state, action, pending] = useActionState(mutateScale, {}); const router = useRouter(); useEffect(() => { if (state.redirectTo)
    router.push(state.redirectTo); }, [router, state.redirectTo]); return <form action={action} className="grid gap-4"><input type="hidden" name="operation" value={operation}/>{Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value}/>)}{children}{state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}<button disabled={pending} className="w-fit rounded-xl bg-teal-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{pending ? 'Saving…' : button}</button></form>; }
export function PrintReport() { return <button onClick={() => window.print()} className="rounded-xl border px-4 py-2 print:hidden">Print / Save PDF</button>; }
