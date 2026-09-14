"use client";

import { useEffect, useRef } from "react";
import { RoleSurveyResponseForm } from "@/components/role-survey-response-form";

export function RoleSurveyPreview({ title, roleTitle, department, introMessage, thankYouMessage, onClose }: {
  title: string; roleTitle: string; department: string | null;
  introMessage: string; thankYouMessage: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="survey-preview-title" className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[980px] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
        <div>
          <h2 id="survey-preview-title" className="text-xl font-semibold">Preview Survey</h2>
          <p className="mt-1 text-sm text-slate-600">Try the recipient’s view using your current settings. Nothing is sent or saved, and the survey’s status stays unchanged.</p>
        </div>
        <button type="button" autoFocus onClick={() => dialog.current?.close()} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">Close preview</button>
      </div>
      <div className="grid gap-6 p-5 sm:p-8">
        {department ? <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold">{department}</div> : null}
        <RoleSurveyResponseForm preview token="" recipientName="Preview recipient" surveyTitle={title} roleTitle={roleTitle} introMessage={introMessage} thankYouMessage={thankYouMessage} surveyStatus="draft" recipientStatus="pending" completedAt={null} />
      </div>
    </dialog>
  );
}
