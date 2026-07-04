"use client";

import { useState } from "react";

export function WorkspaceSetupForm(props: {
  authEmail: string;
  authUserId: string;
  defaultFullName: string;
  defaultOrganizationName: string;
  defaultIndustryName: string;
  setupToken: string;
}) {
  const [fullName, setFullName] = useState(props.defaultFullName);
  const [organizationName, setOrganizationName] = useState(
    props.defaultOrganizationName,
  );
  const [industryName, setIndustryName] = useState(props.defaultIndustryName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/workspace/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authEmail: props.authEmail,
          authUserId: props.authUserId,
          fullName,
          organizationName,
          industryName,
          setupToken: props.setupToken,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Unable to initialize workspace.");
        return;
      }

      const message = payload.message ?? "Workspace initialized.";
      window.location.assign(
        `/dashboard?message=${encodeURIComponent(message)}`,
      );
    } catch {
      setErrorMessage("Unable to initialize workspace.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Your full name
        </span>
        <input
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
          type="text"
          name="full_name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Organization name
        </span>
        <input
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
          type="text"
          name="organization_name"
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">
          Industry
        </span>
        <input
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
          type="text"
          name="industry_name"
          value={industryName}
          onChange={(event) => setIndustryName(event.target.value)}
          placeholder="Healthcare, education, manufacturing, financial services..."
          required
        />
      </label>
      {errorMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-900">
          {errorMessage}
        </div>
      ) : null}
      <button
        className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? "Creating Admin Profile..."
          : "Create Admin Profile and Seed Demo Data"}
      </button>
    </form>
  );
}
