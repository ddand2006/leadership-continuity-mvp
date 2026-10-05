'use client';

import { useState } from 'react';

type Application = { id: string; organization_name: string; contact_name: string; email: string; phone: string | null; website: string | null; status: string; review_notes: string | null; created_at: string; reviewed_at: string | null };

export function PartnerApplicationQueue({ initial }: { initial: Application[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  async function decide(id: string, status: 'approved' | 'rejected' | 'suspended') {
    setBusy(id); setError('');
    try {
      const response = await fetch('/api/platform-operations/partner-applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Unable to save decision.');
      setRows(current => current.map(row => row.id === id ? { ...row, ...data } : row));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save decision.'); }
    finally { setBusy(null); }
  }
  return <section className="space-y-4">{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}{rows.length === 0 && <div className="rounded-2xl border bg-white p-8 text-slate-600">No partner applications have been submitted.</div>}{rows.map(row => <article key={row.id} className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-slate-900">{row.organization_name}</h2><p className="mt-1 text-sm text-slate-600">{row.contact_name} · {row.email}{row.phone ? ` · ${row.phone}` : ''}</p>{row.website && <a className="mt-1 inline-block text-sm text-blue-800 underline" href={row.website} target="_blank" rel="noreferrer">{row.website}</a>}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold capitalize">{row.status}</span></div><p className="mt-4 text-sm text-slate-600">Submitted {new Date(row.created_at).toLocaleString()}</p>{row.review_notes && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{row.review_notes}</p>}<div className="mt-5 flex flex-wrap gap-3"><button disabled={busy === row.id || row.status === 'approved'} onClick={() => decide(row.id, 'approved')} className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve</button><button disabled={busy === row.id || row.status === 'rejected'} onClick={() => decide(row.id, 'rejected')} className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">Decline</button><button disabled={busy === row.id || row.status === 'suspended'} onClick={() => decide(row.id, 'suspended')} className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50">Suspend</button></div></article>)}</section>;
}
