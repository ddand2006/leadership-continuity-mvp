'use client';
import { useActionState, useEffect, type ReactNode } from 'react';
import { mutateCommerce } from '@/lib/coaching/commerce-actions';
export function CommerceForm({ operation, hidden = {}, button = 'Save', children }: {
    operation: string;
    hidden?: Record<string, string>;
    button?: string;
    children?: ReactNode;
}) {
    const [state, action, pending] = useActionState(mutateCommerce, {});
    useEffect(() => { if (state.redirectTo)
        window.location.assign(state.redirectTo); }, [state.redirectTo]);
    return <form action={action} className="grid gap-4"><input type="hidden" name="operation" value={operation}/>{Object.entries(hidden).map(([key, value]) => <input key={key} name={key} type="hidden" value={value}/>)}{children}{state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{state.error}</p>}{state.success && <p role="status" className="text-teal-800">{state.success}</p>}<button disabled={pending} className="w-fit rounded-xl bg-teal-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Working…' : button}</button></form>;
}
