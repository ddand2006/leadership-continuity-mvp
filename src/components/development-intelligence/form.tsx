'use client';
import { useActionState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { mutateDevelopment } from '@/lib/development-intelligence-actions';
export function DevelopmentForm({ operation, hidden = {}, button = 'Save', children }: {
    operation: string;
    hidden?: Record<string, string>;
    button?: string;
    children?: ReactNode;
}) {
    const [state, action, pending] = useActionState(mutateDevelopment, {});
    const router = useRouter();
    useEffect(() => { if (state.redirectTo)
        router.push(state.redirectTo); }, [state.redirectTo, router]);
    return <form action={action} className="grid gap-4"><input type="hidden" name="operation" value={operation}/>{Object.entries(hidden).map(([k, v]) => <input type="hidden" key={k} name={k} value={v}/>)}{children}{state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{state.error}</p>}{state.success && <p role="status" className="text-teal-800">{state.success}</p>}<button disabled={pending} className="w-fit rounded-xl bg-teal-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{pending ? 'Saving…' : button}</button></form>;
}
