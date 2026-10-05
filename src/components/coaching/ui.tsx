import type { ReactNode } from 'react';
export function Panel({ title, children, className = "" }: {
    title?: string;
    children: ReactNode;
    className?: string;
}) { return <section className={`ui-panel p-5 sm:p-7 ${className}`}>{title && <h2 className="mb-4 text-xl font-semibold text-teal-950">{title}</h2>}{children}</section>; }
export function Field({ name, label, type = 'text', value, required = false, step }: {
    name: string;
    label?: string;
    type?: string;
    value?: string | number | null;
    required?: boolean;
    step?: string;
}) { return <label className="grid gap-1 text-sm font-medium">{label ?? name.replaceAll('_', ' ')}{type === 'textarea' ? <textarea className="ui-input" name={name} defaultValue={value ?? ''} required={required}/> : <input className="ui-input" name={name} type={type} step={step} defaultValue={value ?? ''} required={required}/>}</label>; }
export function Select({ name, label, options, value, empty }: {
    name: string;
    label?: string;
    options: (string | {
        value: string;
        label: string;
    })[];
    value?: string;
    empty?: string;
}) { const uniqueOptions = options.filter((option, index, all) => { const optionValue = typeof option === 'string' ? option : option.value; return all.findIndex(candidate => (typeof candidate === 'string' ? candidate : candidate.value) === optionValue) === index; }); return <label className="grid gap-1 text-sm font-medium">{label ?? name.replaceAll('_', ' ')}<select className="ui-input" name={name} defaultValue={value}>{empty !== undefined && <option value="">{empty}</option>}{uniqueOptions.map(o => { const v = typeof o === 'string' ? o : o.value; return <option key={v} value={v}>{typeof o === 'string' ? o.replaceAll('_', ' ') : o.label}</option>; })}</select></label>; }
export function Metrics({ values }: {
    values: Record<string, number>;
}) { return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(values).map(([name, value]) => <Panel key={name}><p className="text-sm text-slate-600">{name}</p><p className="mt-2 text-3xl font-semibold text-teal-950">{Number.isInteger(value) ? value : value.toFixed(2)}</p></Panel>)}</div>; }
