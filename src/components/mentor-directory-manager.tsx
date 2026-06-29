"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type MentorRecord = {
  id: string;
  full_name: string;
  email: string;
  position_title: string | null;
};

export function MentorDirectoryManager({
  mentors,
}: {
  mentors: MentorRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdLogin, setCreatedLogin] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);

  function handleSubmit(formData: FormData, form: HTMLFormElement) {
    setError(null);
    setSuccess(null);
    setCreatedLogin(null);

    startTransition(async () => {
      const response = await fetch("/api/mentors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: String(formData.get("full_name") ?? ""),
          email: String(formData.get("email") ?? ""),
          position_title: String(formData.get("position_title") ?? ""),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        loginEmail?: string;
        temporaryPassword?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to create mentor.");
        return;
      }

      form.reset();
      setSuccess(payload.message ?? "Mentor created.");
      if (payload.loginEmail && payload.temporaryPassword) {
        setCreatedLogin({
          email: payload.loginEmail,
          temporaryPassword: payload.temporaryPassword,
        });
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-[rgba(82,140,94,0.2)] bg-[rgba(239,251,241,0.96)] p-8 text-[#183822] shadow-[0_20px_60px_rgba(36,64,216,0.1)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-[#24512f] uppercase">
            Mentors in the System
          </p>
          <h2 className="mt-3 font-display text-3xl text-[#14361d]">
            Add mentors manually
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#24512f]">
            Each mentor gets a unique login using their email address. When you
            create a mentor here, the system creates both the mentor profile and
            a temporary password for first sign-in.
          </p>
        </div>
        <div className="emerald-soft-surface rounded-2xl border px-4 py-3 text-sm text-[#24512f]">
          <p className="font-semibold text-[#14361d]">Current mentors</p>
          <p className="mt-1 text-2xl font-semibold text-[#14361d]">{mentors.length}</p>
        </div>
      </div>

      <form
        className="mt-6 grid gap-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit(new FormData(event.currentTarget), event.currentTarget);
        }}
      >
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#24512f]">
            Mentor name
          </span>
          <input
            className="w-full rounded-2xl border border-[#57c95f] bg-white/35 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38] focus:bg-white/55"
            type="text"
            name="full_name"
            placeholder="Jane Leader"
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#24512f]">
            Position
          </span>
          <input
            className="w-full rounded-2xl border border-[#57c95f] bg-white/35 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38] focus:bg-white/55"
            type="text"
            name="position_title"
            placeholder="Chief Nursing Officer"
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#24512f]">
            Email / login
          </span>
          <input
            className="w-full rounded-2xl border border-[#57c95f] bg-white/35 px-4 py-3 text-sm text-[#14361d] outline-none transition focus:border-[#2d7c38] focus:bg-white/55"
            type="email"
            name="email"
            placeholder="mentor@hospital.org"
            required
          />
        </label>
        <div className="md:col-span-3">
          <button
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            type="submit"
            disabled={isPending}
          >
            {isPending ? "Creating mentor login..." : "Create Mentor Login"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-[#24512f]">{success}</p> : null}
      {createdLogin ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-semibold text-amber-950">Share these first-login credentials now</p>
          <p className="mt-2">
            Login email: <span className="font-semibold">{createdLogin.email}</span>
          </p>
          <p>
            Temporary password:{" "}
            <span className="font-semibold">{createdLogin.temporaryPassword}</span>
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        {mentors.length > 0 ? (
          mentors.map((mentor) => (
            <article
              key={mentor.id}
              className="emerald-soft-surface rounded-2xl border px-4 py-4 text-sm text-[#14361d]"
            >
              <p className="font-semibold text-[#14361d]">{mentor.full_name}</p>
              <p className="mt-1 text-[#24512f]">
                {mentor.position_title || "Position not entered"}
              </p>
              <p className="mt-1 text-[#24512f]">Login: {mentor.email}</p>
            </article>
          ))
        ) : (
          <article className="emerald-soft-surface rounded-2xl border border-dashed px-4 py-4 text-sm leading-7 text-[#24512f]">
            No mentors have been entered yet. Add the first mentor here and the
            app will create a unique login for that person.
          </article>
        )}
      </div>
    </section>
  );
}
