import type { ReactNode } from 'react';
export function Panel({ title, children }: {
    title?: string;
    children: ReactNode;
}) { return <section className="theme-panel rounded-3xl border border-slate-200 bg-white/80 p-5 sm:p-7">{title && <h2 className="mb-4 text-xl font-semibold text-teal-950">{title}</h2>}{children}</section>; }
export function Field({ name, label, type = 'text', value, required = false, step }: {
    name: string;
    label?: string;
    type?: string;
    value?: string | number | null;
    required?: boolean;
    step?: string;
}) { return <label className="grid gap-1 text-sm font-medium">{label ?? name.replaceAll('_', ' ')}{type === 'textarea' ? <textarea className="rounded-xl border border-slate-300 bg-white p-3" name={name} defaultValue={value ?? ''} required={required}/> : <input className="min-w-0 rounded-xl border border-slate-300 bg-white p-3" name={name} type={type} step={step} defaultValue={value ?? ''} required={required}/>}</label>; }
export function Select({ name, label, options, value, empty }: {
    name: string;
    label?: string;
    options: (string | {
        value: string;
        label: string;
    })[];
    value?: string;
    empty?: string;
}) { return <label className="grid gap-1 text-sm font-medium">{label ?? name.replaceAll('_', ' ')}<select className="min-w-0 rounded-xl border border-slate-300 bg-white p-3" name={name} defaultValue={value}>{empty !== undefined && <option value="">{empty}</option>}{options.map(o => { const v = typeof o === 'string' ? o : o.value; return <option key={v} value={v}>{typeof o === 'string' ? o.replaceAll('_', ' ') : o.label}</option>; })}</select></label>; }
export function Metrics({ values }: {
    values: Record<string, number>;
}) { return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(values).map(([name, value]) => <Panel key={name}><p className="text-sm text-slate-600">{name}</p><p className="mt-2 text-3xl font-semibold text-teal-950">{Number.isInteger(value) ? value : value.toFixed(2)}</p></Panel>)}</div>; }
