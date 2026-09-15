'use client';
import { useActionState, useState, useRef, useEffect, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { mutateCoaching } from '@/lib/coaching/actions';
export function CoachingForm({ operation, hidden = {}, button = 'Save', showSubmit = true, onInvalid, children }: {
    operation: string;
    hidden?: Record<string, string>;
    button?: string;
    showSubmit?: boolean;
    onInvalid?: (event:FormEvent<HTMLFormElement>)=>void;
    children?: ReactNode;
}) {
    const [state, action, pending] = useActionState(mutateCoaching, {});
    const router=useRouter();
    useEffect(()=>{if(state.redirectTo)router.push(state.redirectTo);},[state.redirectTo,router]);
    return <form action={action} onInvalidCapture={onInvalid} className="grid gap-3"><input type="hidden" name="operation" value={operation}/>{Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v}/>)}{children}{showSubmit&&<button disabled={pending} className="interactive-contrast w-fit rounded-full bg-teal-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Saving…' : button}</button>}{state.error && <p role="alert" className="text-red-800">{state.error}</p>}{state.success && <p role="status" className="text-teal-800">{state.success}</p>}</form>;
}
export function UnlockCoaching() {
    const dialog = useRef<HTMLDialogElement>(null);
    return <><button className="rounded-full bg-teal-950 px-5 py-2 text-white" onClick={() => dialog.current?.showModal()}>Unlock Coaching</button><dialog ref={dialog} aria-label="Add Coaching to Leader Continuity" className="fixed inset-0 z-50 m-auto max-w-lg rounded-3xl border border-teal-200 bg-white p-8 shadow-2xl backdrop:bg-slate-950/40"><h2 className="text-xl font-semibold">Add Coaching to Leader Continuity</h2><p className="my-4">Professional Coaching connects leaders with experienced coaches and integrates coaching goals with leadership development plans.</p><CoachingForm operation="opt_in" button="Request Coaching Access"/><button className="mt-4 underline" onClick={() => dialog.current?.close()}>Close</button></dialog></>;
}
export function ExportLog({ query }: {
    query: string;
}) {
    const [open, setOpen] = useState(false);
    return <div><button className="underline" onClick={() => setOpen(!open)}>Export CSV</button>{open && <div className="mt-3 rounded-2xl border p-4"><p>This export may contain confidential or personally identifiable client information. Store and transmit it securely and only for authorized coaching or credential-verification purposes.</p><a className="mt-3 inline-block font-semibold underline" href={`/api/coaching/log?${query}`}>Download coaching log CSV</a></div>}</div>;
}
