"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type RoleMentorDialogProps = {
  roleId: string;
  roleTitle: string;
  mentors: Array<{
    id: string;
    full_name: string;
    position_title: string | null;
  }>;
};

export function RoleMentorDialog({
  roleId,
  roleTitle,
  mentors,
}: RoleMentorDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function closeDialog() {
    setIsOpen(false);
    setError(null);
    setSuccess(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/roles/mentor-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roleId,
          mentorProfileId: String(formData.get("mentorProfileId") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        }),
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to attach mentor to role.");
        return;
      }

      setSuccess(result.message ?? "Mentor attached to role.");
      router.refresh();

      window.setTimeout(() => {
        closeDialog();
      }, 900);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
      >
        Add Mentor
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.98)] p-8 text-[#183822] shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
                  Role Mentor
                </p>
                <h2 className="mt-3 font-display text-3xl text-[#14361d]">
                  Attach a mentor to this role
                </h2>
                <p className="mt-4 text-sm leading-7 text-[#24512f]">
                  Choose the mentor for <span className="font-semibold">{roleTitle}</span>.
                  That mentor will be available for candidate-role assignments tied
                  to this role.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full border border-[#57c95f] bg-white/35 px-4 py-2 text-sm font-semibold text-[#14361d] transition hover:bg-white/55"
              >
                Close
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit(new FormData(event.currentTarget));
              }}
            >
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#24512f]">
                  Mentor
                </span>
                <select
                  className="w-full rounded-2xl border border-[#57c95f] bg-white/35 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38] focus:bg-white/55"
                  name="mentorProfileId"
                  defaultValue=""
                  required
                >
                  <option value="">Select mentor</option>
                  {mentors.map((mentor) => (
                    <option key={mentor.id} value={mentor.id} className="text-slate-900">
                      {mentor.full_name}
                      {mentor.position_title ? ` • ${mentor.position_title}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#24512f]">
                  Notes
                </span>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-[#57c95f] bg-white/35 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38] focus:bg-white/55"
                  name="notes"
                  placeholder="Optional notes about how this mentor supports the role."
                />
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending || mentors.length === 0}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isPending ? "Attaching mentor..." : "Attach Mentor to Role"}
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-full border border-[#57c95f] bg-white/35 px-5 py-3 text-sm font-semibold text-[#14361d] transition hover:bg-white/55"
                >
                  Cancel
                </button>
              </div>
            </form>

            {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
            {success ? <p className="mt-4 text-sm text-[#24512f]">{success}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
