"use client";

import Link from "next/link";
import { useState } from "react";

type ReviewSubject = {
  value: string;
  name: string;
  roleTitle: string;
  kind: "employee" | "candidate";
};

type Cycle = {
  id: string;
  title: string;
  employeeName: string;
  roleTitle: string;
  status: string;
  dueDate: string | null;
  completed: number;
  invited: number;
};

export function Review360Workspace({
  subjects,
  employees,
  roles,
  cycles,
  initialSubjectValue,
}: {
  subjects: ReviewSubject[];
  employees: { id: string; name: string }[];
  roles: { id: string; title: string }[];
  cycles: Cycle[];
  initialSubjectValue?: string;
}) {
  const [subjectValue, setSubjectValue] = useState(
    initialSubjectValue && subjects.some((subject) => subject.value === initialSubjectValue)
      ? initialSubjectValue
      : (subjects[0]?.value ?? ""),
  );
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [roleId, setRoleId] = useState("");

  async function createReview(event: React.FormEvent) {
    event.preventDefault();
    const subject = subjects.find((item) => item.value === subjectValue);
    if (!subject) return;

    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/360-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(subject.kind === "candidate"
          ? { candidateId: subject.value.replace("candidate:", "") }
          : { employeeRoleAssignmentId: subject.value.replace("employee:", "") }),
        title,
        dueDate: dueDate || undefined,
      }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(body.error ?? "Unable to create review.");
      return;
    }
    window.location.assign(`/360-review/${body.id}`);
  }

  async function assignRole(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/360-review-role-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationUserId: employeeId, roleId }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(body.error ?? "Unable to assign current role.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active 360 Reviews", cycles.filter((cycle) => ["invitations_pending", "in_progress"].includes(cycle.status)).length],
          ["Awaiting Responses", cycles.reduce((sum, cycle) => sum + cycle.invited - cycle.completed, 0)],
          ["Ready for Analysis", cycles.filter((cycle) => cycle.status === "ready_for_review").length],
          ["Completed Reviews", cycles.filter((cycle) => cycle.status === "completed").length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">{label}</p>
            <p className="mt-2 font-display text-4xl text-teal-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold tracking-[.16em] text-teal-700 uppercase">Employee setup</p>
        <h2 className="mt-2 font-display text-3xl text-slate-900">Assign an employee’s current role</h2>
        <p className="mt-2 text-sm text-slate-600">Use this for employees managed from Administration. Candidate current roles can be set from the candidate Overview.</p>
        <form onSubmit={assignRole} className="mt-5 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-semibold">Employee<select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2"><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-semibold">Current role<select required value={roleId} onChange={(event) => setRoleId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2"><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}</select></label>
          <button disabled={saving} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Assign current role</button>
        </form>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold tracking-[.16em] text-teal-700 uppercase">New review</p>
        <h2 className="mt-2 font-display text-3xl text-slate-900">Create a current-role 360 review</h2>
        <p className="mt-2 text-sm text-slate-600">Choose an employee or a candidate with a saved Current Role. The current Ideal Role Composite is snapshotted when you create the review.</p>
        {subjects.length ? (
          <form onSubmit={createReview} className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-slate-700">Person and current role<select required value={subjectValue} onChange={(event) => setSubjectValue(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">{subjects.map((subject) => <option value={subject.value} key={subject.value}>{subject.name} — {subject.roleTitle}{subject.kind === "candidate" ? " (candidate)" : ""}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">Review title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="2026 Baseline 360" className="rounded-xl border border-slate-300 px-3 py-2" /></label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2" /></label>
            <button disabled={saving} className="w-fit rounded-full bg-teal-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Creating…" : "Create 360 Review"}</button>
          </form>
        ) : <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Assign a current role to an employee or candidate before launching a 360 Review.</p>}
        {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="p-7"><p className="text-sm font-semibold tracking-[.16em] text-teal-700 uppercase">Active and completed reviews</p><h2 className="mt-2 font-display text-3xl text-slate-900">Review cycles</h2></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-6 py-3">Person</th><th>Role</th><th>Status</th><th>Responses</th><th>Due</th><th /></tr></thead><tbody>{cycles.map((cycle) => <tr key={cycle.id} className="border-t border-slate-100"><td className="px-6 py-4 font-semibold">{cycle.employeeName}</td><td>{cycle.roleTitle}</td><td className="capitalize">{cycle.status.replaceAll("_", " ")}</td><td>{cycle.completed} / {cycle.invited}</td><td>{cycle.dueDate ?? "—"}</td><td><Link href={`/360-review/${cycle.id}`} className="font-semibold text-teal-800">Manage respondents</Link></td></tr>)}{!cycles.length ? <tr><td colSpan={6} className="px-6 py-8 text-slate-500">No review cycles have been created.</td></tr> : null}</tbody></table></div>
      </section>
    </div>
  );
}
