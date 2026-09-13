"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SavedDocument = {
  id: string; title: string; file_name: string; created_at: string;
  recipients: { id: string; name: string; email: string; relationship: string }[];
};

export function MentoringDocumentLibrary({ candidateId }: { candidateId: string }) {
  return <DocumentLibrary key={candidateId} candidateId={candidateId} />;
}

function DocumentLibrary({ candidateId }: { candidateId: string }) {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const attempts = useRef<Record<string, string>>({});
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/mentoring/documents?candidateId=${candidateId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load documents.");
      if (version === loadVersion.current) setDocuments(payload.documents);
    } catch (error) {
      if (version === loadVersion.current) setError(error instanceof Error ? error.message : "Unable to load documents.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [candidateId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const refresh = () => { void load(); };
    window.addEventListener("mentoring-document-saved", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener("mentoring-document-saved", refresh); };
  }, [load]);

  async function send(document: SavedDocument) {
    const recipientId = selected[document.id];
    if (!recipientId || busy) return;
    setBusy(document.id); setError(null); setMessage(null);
    const key = `${document.id}:${recipientId}`;
    const requestId = attempts.current[key] ?? crypto.randomUUID();
    attempts.current[key] = requestId;
    try {
      const response = await fetch("/api/mentoring/documents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, documentId: document.id, recipientId, requestId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to send email.");
      delete attempts.current[key];
      setMessage(payload.message);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to send email."); }
    finally { setBusy(null); }
  }

  return (
    <section className="my-6 rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-2" aria-label="Saved mentoring documents">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-slate-900">Saved mentoring documents</h3>
        <button type="button" onClick={() => void load()} disabled={loading} className="text-sm font-semibold text-teal-800 disabled:opacity-50">Refresh</button>
      </div>
      <p className="mt-2 text-sm text-slate-600">Word exports are saved here automatically. Download a saved copy or email it as an attachment to the mentee or an assigned mentor.</p>
      {loading ? <p className="mt-3 text-sm" role="status">Loading documents…</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-teal-800" role="status">{message}</p> : null}
      {!loading && !error && documents.length === 0 ? <p className="mt-4 text-sm text-slate-500">No saved documents yet. Generate a Word document to save the first copy.</p> : null}
      <ul className="mt-4 grid gap-4">
        {documents.map((document) => (
          <li key={document.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-900">{document.title}</p>
            <p className="mt-1 text-xs text-slate-500">Saved {new Date(document.created_at).toLocaleString()}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a className="text-sm font-semibold text-teal-800 underline" href={`/api/mentoring/documents?candidateId=${candidateId}&documentId=${document.id}`} download={document.file_name}>Download Word document</a>
              <select aria-label={`Email recipient for ${document.title}`} className="max-w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={selected[document.id] ?? ""} onChange={(event) => setSelected((current) => ({ ...current, [document.id]: event.target.value }))} disabled={Boolean(busy)}>
                <option value="">Choose mentor or mentee</option>
                {document.recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.relationship}: {recipient.name} ({recipient.email})</option>)}
              </select>
              <button type="button" disabled={!selected[document.id] || Boolean(busy)} onClick={() => void send(document)} className="rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === document.id ? "Sending…" : "Email document"}</button>
            </div>
            {document.recipients.length === 0 ? <p className="mt-2 text-sm text-slate-500">No recipient email is available. Add the mentee’s account or assign a mentor with an active account.</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
