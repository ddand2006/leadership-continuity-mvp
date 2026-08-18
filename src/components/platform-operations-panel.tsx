"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

type RequestItem = {
  id: string;
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  role_title: string;
  status: string;
  created_at: string;
  notes: string | null;
};

type OrganizationItem = {
  id: string;
  name: string;
  manual_access_status: "active" | "payment_hold";
  manual_access_note: string | null;
};

type ApiResponse = {
  message?: string;
  error?: string;
  organizationId?: string;
  workspaceUrl?: string;
};

export function PlatformOperationsPanel(props: {
  requests: RequestItem[];
  organizations: OrganizationItem[];
  salesNotificationEmail: string | null;
  remindersEnabled: boolean;
}) {
  const [email, setEmail] = useState(props.salesNotificationEmail ?? "");
  const [remindersEnabled, setRemindersEnabled] = useState(props.remindersEnabled);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(payload: Record<string, unknown>) {
    startTransition(async () => {
      setFeedback("");
      const response = await fetch("/api/platform-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as ApiResponse;
      setFeedback(body.message ?? body.error ?? "Unable to save the update.");

      if (response.ok && body.workspaceUrl) {
        window.location.assign(body.workspaceUrl);
      } else if (body.organizationId) {
        window.location.assign(`/platform-operations/support/${body.organizationId}`);
      } else if (response.ok) {
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="theme-panel-strong rounded-[2rem] p-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">
              Notifications & follow-up
            </p>
            <h2 className="mt-2 font-display text-3xl">Sales queue controls</h2>
          </div>
          <button type="button" className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold" disabled={isPending} onClick={() => submit({ action: "send-due-reminders" })}>
            Send due reminders now
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" placeholder="Notification email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold"><input type="checkbox" checked={remindersEnabled} onChange={(event) => setRemindersEnabled(event.target.checked)} /> Enable reminders</label>
          <button className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white" disabled={isPending} onClick={() => submit({ action: "settings", salesNotificationEmail: email, remindersEnabled })}>Save notifications</button>
        </div>
        {feedback ? <p className="mt-4 text-sm font-medium text-teal-800">{feedback}</p> : null}
        <p className="mt-3 text-sm leading-6 text-slate-600">New account requests email this address immediately. Follow-up cadence is monthly for the first 90 days, quarterly through the first year, then every six months.</p>
      </section>

      <section className="theme-panel-strong rounded-[2rem] p-7">
        <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">Prospective organizations</p>
        <h2 className="mt-2 font-display text-3xl">Account requests</h2>
        <div className="mt-6 space-y-3">
          {props.requests.length ? props.requests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><h3 className="font-semibold text-slate-900">{request.company_name}</h3><p className="mt-1 text-sm text-slate-600">{request.full_name} · {request.role_title} · {request.email} · {request.phone}</p><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{request.status} · requested {new Date(request.created_at).toLocaleDateString()}</p></div>
                <div className="flex flex-wrap gap-2"><button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold" disabled={isPending} onClick={() => submit({ action: "request-status", requestId: request.id, status: "contacted" })}>Mark contacted</button><button className="interactive-contrast rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white" disabled={isPending} onClick={() => submit({ action: "approve-request", requestId: request.id })}>Approve & activate</button><button className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700" disabled={isPending} onClick={() => submit({ action: "request-status", requestId: request.id, status: "declined" })}>Decline</button></div>
              </div>
            </article>
          )) : <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">No account requests are waiting right now.</p>}
        </div>
      </section>

      <section className="theme-panel-strong rounded-[2rem] p-7">
        <p className="text-sm font-semibold tracking-[0.16em] text-teal-700 uppercase">Customer operations</p>
        <h2 className="mt-2 font-display text-3xl">Organizations, holds, and support</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Open a full support workspace to work throughout an organization as its administrator. Every entry is audited, and individual 360 answers remain confidential.</p>
        <div className="mt-6 grid gap-3">
          {props.organizations.map((organization) => (
            <article key={organization.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div><h3 className="font-semibold text-slate-900">{organization.name}</h3><p className="mt-1 text-sm text-slate-600">{organization.manual_access_status === "payment_hold" ? "Payment hold — data preserved; internal users are locked out." : "Active access"}</p></div>
              <div className="flex flex-wrap gap-2">
                <button className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white" disabled={isPending} onClick={() => submit({ action: "support-session", organizationId: organization.id, reason: "Platform support" })}>Open full workspace</button>
                <Link className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold" href={`/platform-operations/support/${organization.id}`}>Open support summary</Link>
                <Link className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold" href={`/administration?organizationId=${organization.id}`}>User administration</Link>
                <button className={`rounded-full px-4 py-2 text-sm font-semibold ${organization.manual_access_status === "payment_hold" ? "bg-emerald-700 text-white" : "bg-rose-700 text-white"}`} disabled={isPending} onClick={() => submit({ action: "access-status", organizationId: organization.id, accessStatus: organization.manual_access_status === "payment_hold" ? "active" : "payment_hold" })}>{organization.manual_access_status === "payment_hold" ? "Restore access" : "Place on hold"}</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
