"use client";

import { useEffect, useState } from "react";

type Question = { id: string; prompt: string; displayOrder: number };
type Competency = { id: string; name: string; definition: string; questions: Question[] };

export function Review360ResponseForm({ token, employeeName, competencies, completed }: { token: string; employeeName: string; competencies: Competency[]; completed: boolean }) {
  const [relationship, setRelationship] = useState("peer");
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(completed ? "This response has already been submitted." : "");

  useEffect(() => { if (!completed) fetch(`/api/360-review-surveys/${token}`, { method: "PATCH" }); }, [completed, token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const questions = competencies.flatMap((competency) => competency.questions);
    const response = await fetch(`/api/360-review-surveys/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationship, ratings: questions.map((question) => ({ questionId: question.id, rating: ratings[question.id] === "na" ? null : Number(ratings[question.id]) || null })) }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error);
  }

  return <form onSubmit={submit} className="grid gap-6">
    {competencies.map((competency) => <section key={competency.id} className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-display text-2xl">{competency.name}</h2>
      <p className="mt-2 text-sm text-slate-600">{competency.definition}</p>
      <div className="mt-6 grid gap-6">
        {competency.questions.map((question, index) => <fieldset key={question.id} className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
          <legend className="text-sm font-semibold text-slate-800">{index + 1}. {question.prompt}</legend>
          <p className="mt-2 text-sm text-slate-600">How consistently does {employeeName} demonstrate this behavior?</p>
          <div className="mt-3 flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((score) => <label key={score} className="rounded-full border px-3 py-2 text-sm"><input required type="radio" name={question.id} checked={ratings[question.id] === String(score)} onChange={() => setRatings({ ...ratings, [question.id]: String(score) })} /> {score}</label>)}<label className="rounded-full border px-3 py-2 text-sm"><input required type="radio" name={question.id} checked={ratings[question.id] === "na"} onChange={() => setRatings({ ...ratings, [question.id]: "na" })} /> N/A</label></div>
        </fieldset>)}
      </div>
    </section>)}
    <section className="rounded-2xl bg-slate-50 p-6"><label className="grid gap-2 text-sm font-semibold">Working relationship<select value={relationship} onChange={(event) => setRelationship(event.target.value)} className="rounded-xl border p-2"><option value="self">I am {employeeName}</option><option value="supervisor">{employeeName} reports to me</option><option value="peer">I am a coworker or peer</option><option value="direct_report">I report to {employeeName}</option><option value="other">Other</option></select></label></section>
    <button disabled={completed} className="w-fit rounded-full bg-teal-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Submit 360 Review</button>
    {message ? <p className="text-sm text-teal-800">{message}</p> : null}
  </form>;
}
