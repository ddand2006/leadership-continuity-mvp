"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createDefaultRoleSurveyTitle,
  getDefaultRoleSurveyIntroMessage,
  getDefaultRoleSurveyThankYouMessage,
  getRoleSurveyRecipientStatusLabel,
  getRoleSurveyStatusLabel,
  type RoleSurveyRecipientRecord,
  type RoleSurveyRecord,
  type RoleSurveyResponseRecord,
} from "@/lib/role-competency-surveys";

type RoleSurveyPanelProps = {
  roles: Array<{
    id: string;
    title: string;
    department: string | null;
  }>;
  surveys: RoleSurveyRecord[];
  recipients: RoleSurveyRecipientRecord[];
  responses: RoleSurveyResponseRecord[];
  initialSelectedRoleId?: string | null;
  isEmailDeliveryEnabled?: boolean;
  sectionId?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function buildThemeCounts(responses: RoleSurveyResponseRecord[]) {
  const counts = new Map<string, { label: string; count: number }>();

  for (const response of responses) {
    for (const item of response.normalized_competencies) {
      const normalized = item.toLowerCase();
      const current = counts.get(normalized);

      if (current) {
        current.count += 1;
        continue;
      }

      counts.set(normalized, {
        label: item,
        count: 1,
      });
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 12);
}

export function RoleSurveyPanel({
  roles,
  surveys,
  recipients,
  responses,
  initialSelectedRoleId = null,
  isEmailDeliveryEnabled = false,
  sectionId,
}: RoleSurveyPanelProps) {
  const router = useRouter();
  const initialRoleId = initialSelectedRoleId ?? roles[0]?.id ?? "";
  const initialRole = roles.find((role) => role.id === initialRoleId) ?? null;
  const initialSurveysForRole = surveys
    .filter((survey) => survey.role_id === initialRoleId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  const initialSurvey = initialSurveysForRole[0] ?? null;
  const [selectedRoleId, setSelectedRoleId] = useState(initialRoleId);
  const [selectedSurveyId, setSelectedSurveyId] = useState(initialSurvey?.id ?? "");
  const [isCreatingNewSurvey, setIsCreatingNewSurvey] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [title, setTitle] = useState(
    initialSurvey?.title ?? createDefaultRoleSurveyTitle(initialRole?.title ?? "Role"),
  );
  const [description, setDescription] = useState(initialSurvey?.description ?? "");
  const [introMessage, setIntroMessage] = useState(
    initialSurvey?.intro_message ??
      getDefaultRoleSurveyIntroMessage(initialRole?.title ?? "this role"),
  );
  const [thankYouMessage, setThankYouMessage] = useState(
    initialSurvey?.thank_you_message ?? getDefaultRoleSurveyThankYouMessage(),
  );
  const [status, setStatus] = useState<"draft" | "active" | "closed">(
    initialSurvey?.status ?? "draft",
  );
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientTitle, setRecipientTitle] = useState("");
  const [relationshipToRole, setRelationshipToRole] = useState("");
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [surveySuccess, setSurveySuccess] = useState<string | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [recipientSuccess, setRecipientSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [activeEmailRecipientId, setActiveEmailRecipientId] = useState<string | null>(null);
  const [isSurveyPending, startSurveyTransition] = useTransition();
  const [isRecipientPending, startRecipientTransition] = useTransition();
  const [isEmailPending, startEmailTransition] = useTransition();

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const surveysForRole = useMemo(
    () =>
      surveys
        .filter((survey) => survey.role_id === selectedRoleId)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [selectedRoleId, surveys],
  );
  const selectedSurvey = isCreatingNewSurvey
    ? null
    : surveysForRole.find((survey) => survey.id === selectedSurveyId) ??
      surveysForRole[0] ??
      null;
  const recipientsForSurvey = recipients.filter(
    (recipient) => recipient.survey_id === selectedSurvey?.id,
  );
  const responsesForSurvey = responses.filter(
    (response) => response.survey_id === selectedSurvey?.id,
  );
  const recurringThemes = buildThemeCounts(responsesForSurvey);

  function applySurveyFormState(options: {
    role: RoleSurveyPanelProps["roles"][number] | null;
    survey: RoleSurveyRecord | null;
  }) {
    if (options.survey) {
      setTitle(options.survey.title);
      setDescription(options.survey.description ?? "");
      setIntroMessage(options.survey.intro_message ?? "");
      setThankYouMessage(options.survey.thank_you_message ?? "");
      setStatus(options.survey.status);
      return;
    }

    if (options.role) {
      setTitle(createDefaultRoleSurveyTitle(options.role.title));
      setDescription("");
      setIntroMessage(getDefaultRoleSurveyIntroMessage(options.role.title));
      setThankYouMessage(getDefaultRoleSurveyThankYouMessage());
      setStatus("draft");
      return;
    }

    setTitle("");
    setDescription("");
    setIntroMessage("");
    setThankYouMessage("");
    setStatus("draft");
  }

  function resetRecipientFields() {
    setRecipientName("");
    setRecipientEmail("");
    setRecipientTitle("");
    setRelationshipToRole("");
  }

  function handleCreateNewSurvey() {
    setIsCreatingNewSurvey(true);
    setIsSettingsOpen(true);
    setSelectedSurveyId("");
    setSurveyError(null);
    setSurveySuccess(null);
    applySurveyFormState({
      role: selectedRole,
      survey: null,
    });
  }

  function getSurveyLink(token: string) {
    if (typeof window === "undefined") {
      return `/role-surveys/${token}`;
    }

    return `${window.location.origin}/role-surveys/${token}`;
  }

  function copySurveyLink(token: string) {
    const link = getSurveyLink(token);

    if (!navigator.clipboard) {
      setRecipientError("Copy is not available in this browser.");
      return;
    }

    void navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(token);
      setTimeout(() => setCopiedLink((current) => (current === token ? null : current)), 2000);
    });
  }

  function handleSaveSurvey() {
    if (!selectedRoleId) {
      setSurveyError("Choose a role first.");
      return;
    }

    setSurveyError(null);
    setSurveySuccess(null);

    startSurveyTransition(async () => {
      const response = await fetch("/api/role-surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surveyId: selectedSurvey?.id,
          roleId: selectedRoleId,
          title,
          description,
          introMessage,
          thankYouMessage,
          status,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        surveyId?: string;
      };

      if (!response.ok) {
        setSurveyError(payload.error ?? "Unable to save the survey.");
        return;
      }

      setSurveySuccess(payload.message ?? "Survey saved.");
      setIsCreatingNewSurvey(false);
      setSelectedSurveyId(payload.surveyId ?? selectedSurvey?.id ?? "");
      router.refresh();
    });
  }

  function handleAddRecipient() {
    if (!selectedSurvey?.id) {
      setRecipientError("Save the survey first, then add recipients.");
      return;
    }

    setRecipientError(null);
    setRecipientSuccess(null);

    startRecipientTransition(async () => {
      const response = await fetch("/api/role-surveys/recipients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surveyId: selectedSurvey.id,
          recipientName,
          recipientEmail,
          recipientTitle,
          relationshipToRole,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setRecipientError(payload.error ?? "Unable to add the recipient.");
        return;
      }

      setRecipientSuccess(payload.message ?? "Recipient added.");
      resetRecipientFields();
      router.refresh();
    });
  }

  function handleSendSurveyEmail(recipient: RoleSurveyRecipientRecord) {
    setRecipientError(null);
    setRecipientSuccess(null);
    setActiveEmailRecipientId(recipient.id);

    startEmailTransition(async () => {
      const response = await fetch(
        `/api/role-surveys/recipients/${recipient.id}/send`,
        {
          method: "POST",
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setRecipientError(payload.error ?? "Unable to send the survey email.");
        setActiveEmailRecipientId(null);
        return;
      }

      setRecipientSuccess(payload.message ?? "Survey email sent.");
      setActiveEmailRecipientId(null);
      router.refresh();
    });
  }

  function handleRoleChange(nextRoleId: string) {
    const nextRole = roles.find((role) => role.id === nextRoleId) ?? null;
    const nextSurveys = surveys
      .filter((survey) => survey.role_id === nextRoleId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    const nextSurvey = nextSurveys[0] ?? null;

    setSelectedRoleId(nextRoleId);
    setIsCreatingNewSurvey(false);
    setSelectedSurveyId(nextSurvey?.id ?? "");
    setSurveyError(null);
    setSurveySuccess(null);
    applySurveyFormState({
      role: nextRole,
      survey: nextSurvey,
    });
  }

  function handleSelectSurvey(survey: RoleSurveyRecord) {
    setIsCreatingNewSurvey(false);
    setSelectedSurveyId(survey.id);
    setSurveyError(null);
    setSurveySuccess(null);
    applySurveyFormState({
      role: selectedRole,
      survey,
    });
  }

  if (roles.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm leading-7 text-slate-600">
        Add a role first. Then you can launch a competency survey and send it to
        people who know what success really looks like in that role.
      </section>
    );
  }

  return (
    <section id={sectionId} className="grid gap-6">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
          Competency Survey
        </p>
        <h2 className="mt-3 font-display text-3xl text-slate-900">
          Send a role survey to people who know the work
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
          Build an external survey for a role, send the link to leaders or team
          members, and capture what they believe someone in the role needs to know,
          do, and model across the organization.
        </p>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Role
              </span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:bg-white"
                value={selectedRoleId}
                onChange={(event) => handleRoleChange(event.currentTarget.value)}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Surveys for this role
                  </p>
                  <p className="mt-1 text-xs leading-6 text-slate-500">
                    Reuse an existing survey or start a fresh one.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateNewSurvey}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  New Survey
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {surveysForRole.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm leading-7 text-slate-600">
                    No surveys exist for this role yet.
                  </div>
                ) : (
                  surveysForRole.map((survey) => {
                    const surveyRecipientCount = recipients.filter(
                      (recipient) => recipient.survey_id === survey.id,
                    ).length;
                    const surveyResponseCount = responses.filter(
                      (response) => response.survey_id === survey.id,
                    ).length;

                    return (
                      <button
                        key={survey.id}
                        type="button"
                        onClick={() => handleSelectSurvey(survey)}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          selectedSurvey?.id === survey.id
                            ? "border-teal-700 bg-teal-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {survey.title}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-slate-500">
                              Created {formatDate(survey.created_at)}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {getRoleSurveyStatusLabel(survey.status)}
                          </span>
                        </div>
                        <p className="mt-3 text-xs leading-6 text-slate-600">
                          {surveyRecipientCount} recipient
                          {surveyRecipientCount === 1 ? "" : "s"} • {surveyResponseCount} response
                          {surveyResponseCount === 1 ? "" : "s"}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <button
                type="button"
                onClick={() => setIsSettingsOpen((current) => !current)}
                aria-expanded={isSettingsOpen}
                aria-controls="role-survey-settings-panel"
                className="flex w-full items-start justify-between gap-4 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedSurvey ? "Survey settings" : "Create survey"}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-slate-500">
                    {selectedSurvey
                      ? "Open to update the title, messages, and response status for this survey."
                      : "Open to set the survey title, messages, and launch status before sending it out."}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {isSettingsOpen ? "Collapse" : "Expand"}
                </span>
              </button>
              {isSettingsOpen ? (
                <div
                  id="role-survey-settings-panel"
                  className="mt-5 grid gap-4 border-t border-slate-200 pt-5"
                >
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Survey title
                    </span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700"
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.currentTarget.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Description
                    </span>
                    <textarea
                      className="min-h-24 w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-teal-700"
                      value={description}
                      onChange={(event) => setDescription(event.currentTarget.value)}
                      placeholder="Add context for admins reviewing this survey later."
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Intro message
                    </span>
                    <textarea
                      className="min-h-28 w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-teal-700"
                      value={introMessage}
                      onChange={(event) => setIntroMessage(event.currentTarget.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Thank-you message
                    </span>
                    <textarea
                      className="min-h-24 w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-teal-700"
                      value={thankYouMessage}
                      onChange={(event) =>
                        setThankYouMessage(event.currentTarget.value)
                      }
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Status
                    </span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700"
                      value={status}
                      onChange={(event) =>
                        setStatus(
                          event.currentTarget.value as "draft" | "active" | "closed",
                        )
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveSurvey}
                      disabled={isSurveyPending}
                      className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isSurveyPending ? "Saving..." : selectedSurvey ? "Save Survey" : "Create Survey"}
                    </button>
                    {surveyError ? (
                      <p className="text-sm text-rose-700">{surveyError}</p>
                    ) : null}
                    {surveySuccess ? (
                      <p className="text-sm text-teal-700">{surveySuccess}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {selectedSurvey ? (
              <>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Recurring themes
                      </p>
                      <p className="mt-1 text-xs leading-6 text-slate-500">
                        Early pattern view from completed survey responses.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {responsesForSurvey.length} response
                      {responsesForSurvey.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {recurringThemes.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {recurringThemes.map((theme) => (
                        <span
                          key={theme.label}
                          className="rounded-full bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900"
                        >
                          {theme.label} • {theme.count}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      Completed responses will begin surfacing recurring competency
                      themes here.
                    </p>
                  )}
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-slate-900">
                    Add recipient (Minimum of 5 Individuals)
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Name
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:bg-white"
                        type="text"
                        value={recipientName}
                        onChange={(event) =>
                          setRecipientName(event.currentTarget.value)
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Email
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:bg-white"
                        type="email"
                        value={recipientEmail}
                        onChange={(event) =>
                          setRecipientEmail(event.currentTarget.value)
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Title
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:bg-white"
                        type="text"
                        value={recipientTitle}
                        onChange={(event) =>
                          setRecipientTitle(event.currentTarget.value)
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Relationship to role
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:bg-white"
                        type="text"
                        value={relationshipToRole}
                        onChange={(event) =>
                          setRelationshipToRole(event.currentTarget.value)
                        }
                        placeholder="Supervisor, peer, executive partner, etc."
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleAddRecipient}
                      disabled={isRecipientPending}
                      className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isRecipientPending ? "Adding..." : "Add Recipient"}
                    </button>
                    {recipientError ? (
                      <p className="text-sm text-rose-700">{recipientError}</p>
                    ) : null}
                    {recipientSuccess ? (
                      <p className="text-sm text-teal-700">{recipientSuccess}</p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Recipient links
                      </p>
                      <p className="mt-1 text-xs leading-6 text-slate-500">
                        Send the live survey link through Resend or copy it
                        yourself for each respondent.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {recipientsForSurvey.length} recipient
                      {recipientsForSurvey.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {recipientsForSurvey.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                        No recipients have been added yet.
                      </div>
                    ) : (
                      recipientsForSurvey.map((recipient) => (
                        <article
                          key={recipient.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {recipient.recipient_name}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {recipient.recipient_email}
                              </p>
                              <p className="mt-2 text-xs leading-6 text-slate-500">
                                {[recipient.recipient_title, recipient.relationship_to_role]
                                  .filter(Boolean)
                                  .join(" • ") || "No extra details entered"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                {getRoleSurveyRecipientStatusLabel(recipient.status)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSendSurveyEmail(recipient)}
                                disabled={!isEmailDeliveryEnabled || isEmailPending}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                {!isEmailDeliveryEnabled
                                  ? "Email Not Configured"
                                  : isEmailPending &&
                                      activeEmailRecipientId === recipient.id
                                    ? "Sending..."
                                    : "Send Email"}
                              </button>
                              <button
                                type="button"
                                onClick={() => copySurveyLink(recipient.access_token)}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                {copiedLink === recipient.access_token
                                  ? "Copied"
                                  : "Copy Link"}
                              </button>
                            </div>
                          </div>
                          <p className="mt-3 break-all text-xs leading-6 text-slate-500">
                            {getSurveyLink(recipient.access_token)}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
