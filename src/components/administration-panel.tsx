"use client";

import type { Dispatch, SetStateAction } from "react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MentorAssignmentManager } from "@/components/mentor-assignment-manager";
import {
  getAdminRoleLabel,
  getStatusLabel,
  getUserTypeLabel,
  type OrganizationUserAdminRole,
  type OrganizationUserStatus,
} from "@/lib/organization-users";

type AdministrationUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_candidate: boolean;
  is_mentor: boolean;
  admin_role: OrganizationUserAdminRole;
  status: OrganizationUserStatus;
  created_at: string;
  last_login_at: string | null;
  hasHistoricalData: boolean;
};

type AdministrationPanelProps = {
  initialTab: AdministrationTab;
  mentorAssignmentOptions: {
    candidates: Array<{
      id: string;
      full_name: string;
    }>;
    roles: Array<{
      id: string;
      title: string;
    }>;
    mentors: Array<{
      id: string;
      full_name: string;
      position_title: string | null;
    }>;
  };
  users: AdministrationUser[];
  summary: {
    activeCandidates: number;
    activeMentors: number;
    suspendedUsers: number;
    pendingInvitations: number;
  };
  organizations: Array<{
    id: string;
    name: string;
    industry: string | null;
    subscription_status: string | null;
    billing_contact_email: string | null;
    leadership_continuity_enabled: boolean;
    leadership_continuity_tier: string;
    leadership_help_enabled: boolean;
    leadership_help_tier: string;
  }>;
  selectedOrganizationId: string;
  canEditOrganizationAccess: boolean;
  canCreateOrganizations: boolean;
};

type ComposerMode = "create" | "invite" | "edit" | "password";
type SummaryFilterKey =
  | "active-candidates"
  | "active-mentors"
  | "suspended-users"
  | "pending-invitations";
type AdministrationTab =
  | "organization-controls"
  | "user-access"
  | "assign-mentors";

const adminRoleOptions: {
  value: OrganizationUserAdminRole;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "ceo_admin", label: "CEO Admin" },
  { value: "manager_admin", label: "Manager Admin" },
];

const statusOptions: {
  value: OrganizationUserStatus;
  label: string;
}[] = [
  { value: "invited", label: "Invited" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

function formatDate(date: string | null) {
  if (!date) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function getBadgeClassName(status: OrganizationUserStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "invited":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "suspended":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    case "archived":
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}

function defaultFormState(user?: AdministrationUser) {
  return {
    firstName: user?.first_name ?? "",
    lastName: user?.last_name ?? "",
    email: user?.email ?? "",
    password: "",
    isCandidate: user?.is_candidate ?? true,
    isMentor: user?.is_mentor ?? false,
    adminRole: user?.admin_role ?? "none",
    status: user?.status ?? "active",
    temporaryPassword: "",
  };
}

function SummaryCard(props: {
  label: string;
  value: number;
  tone: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.isActive}
      className={`w-full rounded-[1.75rem] border p-6 text-left shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(15,23,42,0.1)] focus:outline-none focus:ring-2 focus:ring-teal-500/60 ${
        props.tone
      } ${props.isActive ? "ring-2 ring-slate-900/15" : ""}`}
    >
      <p className="text-sm font-semibold tracking-[0.16em] uppercase">{props.label}</p>
      <p className="mt-4 font-display text-4xl">{props.value}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
        View list
      </p>
    </button>
  );
}

export function AdministrationPanel({
  initialTab,
  mentorAssignmentOptions,
  users,
  summary,
  organizations,
  selectedOrganizationId,
  canEditOrganizationAccess,
  canCreateOrganizations,
}: AdministrationPanelProps) {
  const router = useRouter();
  const selectedOrganization =
    organizations.find((organization) => organization.id === selectedOrganizationId) ??
    organizations[0] ??
    null;
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [candidateFilter, setCandidateFilter] = useState(false);
  const [mentorFilter, setMentorFilter] = useState(false);
  const [ceoAdminFilter, setCeoAdminFilter] = useState(false);
  const [managerAdminFilter, setManagerAdminFilter] = useState(false);
  const [activeFilter, setActiveFilter] = useState(false);
  const [invitedFilter, setInvitedFilter] = useState(false);
  const [suspendedFilter, setSuspendedFilter] = useState(false);
  const [archivedFilter, setArchivedFilter] = useState(false);
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdministrationUser | null>(null);
  const [formState, setFormState] = useState(defaultFormState());
  const [feedback, setFeedback] = useState<{ error?: string; message?: string; resetLink?: string }>({});
  const [isPending, startTransition] = useTransition();
  const [organizationFeedback, setOrganizationFeedback] = useState<{
    error?: string;
    message?: string;
  }>({});
  const [organizationForm, setOrganizationForm] = useState(
    selectedOrganization
      ? {
          organizationName: selectedOrganization.name,
          industryName: selectedOrganization.industry ?? "",
          billingContactEmail: selectedOrganization.billing_contact_email ?? "",
          subscriptionStatus: selectedOrganization.subscription_status ?? "active",
          leadershipContinuityEnabled:
            selectedOrganization.leadership_continuity_enabled,
          leadershipContinuityTier: selectedOrganization.leadership_continuity_tier,
          leadershipHelpEnabled: selectedOrganization.leadership_help_enabled,
          leadershipHelpTier: selectedOrganization.leadership_help_tier,
        }
      : {
          organizationName: "",
          industryName: "",
          billingContactEmail: "",
          subscriptionStatus: "active",
          leadershipContinuityEnabled: true,
          leadershipContinuityTier: "organization",
          leadershipHelpEnabled: false,
          leadershipHelpTier: "none",
        },
  );
  const [newOrganizationForm, setNewOrganizationForm] = useState({
    organizationName: "",
    industryName: "",
    billingContactEmail: "",
    subscriptionStatus: "active",
    leadershipContinuityEnabled: true,
    leadershipContinuityTier: "organization",
    leadershipHelpEnabled: false,
    leadershipHelpTier: "none",
  });
  const filtersSectionRef = useRef<HTMLElement | null>(null);
  const activeTab = initialTab;
  const organizationSectionSuffix =
    activeTab === "assign-mentors"
      ? "&section=assign-mentors"
      : activeTab === "user-access"
        ? "&section=user-access"
        : "";
  const toggleFilters: Array<{
    label: string;
    value: boolean;
    setValue: Dispatch<SetStateAction<boolean>>;
  }> = [
    { label: "Candidate", value: candidateFilter, setValue: setCandidateFilter },
    { label: "Mentor", value: mentorFilter, setValue: setMentorFilter },
    { label: "CEO Admin", value: ceoAdminFilter, setValue: setCeoAdminFilter },
    {
      label: "Manager Admin",
      value: managerAdminFilter,
      setValue: setManagerAdminFilter,
    },
    { label: "Active", value: activeFilter, setValue: setActiveFilter },
    { label: "Invited", value: invitedFilter, setValue: setInvitedFilter },
    { label: "Suspended", value: suspendedFilter, setValue: setSuspendedFilter },
    { label: "Archived", value: archivedFilter, setValue: setArchivedFilter },
  ];

  const statusFilters = [
    activeFilter ? "active" : null,
    invitedFilter ? "invited" : null,
    suspendedFilter ? "suspended" : null,
    archivedFilter ? "archived" : null,
  ].filter(Boolean) as OrganizationUserStatus[];

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
    const matchesName =
      nameFilter.trim().length === 0 ||
      fullName.includes(nameFilter.trim().toLowerCase());
    const matchesEmail =
      emailFilter.trim().length === 0 ||
      user.email.toLowerCase().includes(emailFilter.trim().toLowerCase());
    const matchesCandidate = !candidateFilter || user.is_candidate;
    const matchesMentor = !mentorFilter || user.is_mentor;
    const matchesCeoAdmin = !ceoAdminFilter || user.admin_role === "ceo_admin";
    const matchesManagerAdmin =
      !managerAdminFilter || user.admin_role === "manager_admin";
    const matchesStatus =
      statusFilters.length === 0 || statusFilters.includes(user.status);

    return (
      matchesName &&
      matchesEmail &&
      matchesCandidate &&
      matchesMentor &&
      matchesCeoAdmin &&
      matchesManagerAdmin &&
      matchesStatus
    );
  });

  const activeSummaryFilter: SummaryFilterKey | null =
    candidateFilter &&
    activeFilter &&
    !mentorFilter &&
    !ceoAdminFilter &&
    !managerAdminFilter &&
    !invitedFilter &&
    !suspendedFilter &&
    !archivedFilter &&
    nameFilter.trim().length === 0 &&
    emailFilter.trim().length === 0
      ? "active-candidates"
      : mentorFilter &&
          activeFilter &&
          !candidateFilter &&
          !ceoAdminFilter &&
          !managerAdminFilter &&
          !invitedFilter &&
          !suspendedFilter &&
          !archivedFilter &&
          nameFilter.trim().length === 0 &&
          emailFilter.trim().length === 0
        ? "active-mentors"
        : suspendedFilter &&
            !candidateFilter &&
            !mentorFilter &&
            !ceoAdminFilter &&
            !managerAdminFilter &&
            !activeFilter &&
            !invitedFilter &&
            !archivedFilter &&
            nameFilter.trim().length === 0 &&
            emailFilter.trim().length === 0
          ? "suspended-users"
          : invitedFilter &&
              !candidateFilter &&
              !mentorFilter &&
              !ceoAdminFilter &&
              !managerAdminFilter &&
              !activeFilter &&
              !suspendedFilter &&
              !archivedFilter &&
              nameFilter.trim().length === 0 &&
              emailFilter.trim().length === 0
            ? "pending-invitations"
            : null;

  function activateSummaryFilter(filter: SummaryFilterKey) {
    setNameFilter("");
    setEmailFilter("");
    setCandidateFilter(filter === "active-candidates");
    setMentorFilter(filter === "active-mentors");
    setCeoAdminFilter(false);
    setManagerAdminFilter(false);
    setActiveFilter(
      filter === "active-candidates" || filter === "active-mentors",
    );
    setInvitedFilter(filter === "pending-invitations");
    setSuspendedFilter(filter === "suspended-users");
    setArchivedFilter(false);
    filtersSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function openComposer(mode: ComposerMode, user?: AdministrationUser) {
    setComposerMode(mode);
    setSelectedUser(user ?? null);
    setFormState(defaultFormState(user));
    setFeedback({});
  }

  function closeComposer() {
    setComposerMode(null);
    setSelectedUser(null);
    setFormState(defaultFormState());
  }

  function updateField<Key extends keyof typeof formState>(
    key: Key,
    value: (typeof formState)[Key],
  ) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  function runAction(
    input: RequestInfo | URL,
    init: RequestInit,
    onSuccess: (payload: { message?: string; resetLink?: string }) => void,
  ) {
    setFeedback({});

    startTransition(async () => {
      try {
        const response = await fetch(input, init);
        const payload = (await response.json()) as {
          error?: string;
          message?: string;
          resetLink?: string;
        };

        if (!response.ok) {
          setFeedback({ error: payload.error ?? "Unable to complete that action." });
          return;
        }

        onSuccess(payload);
        router.refresh();
      } catch {
        setFeedback({ error: "Unable to complete that action right now." });
      }
    });
  }

  function runOrganizationAction(
    input: RequestInfo | URL,
    init: RequestInit,
    onSuccess: (payload: { message?: string; organizationId?: string }) => void,
  ) {
    setOrganizationFeedback({});

    startTransition(async () => {
      try {
        const response = await fetch(input, init);
        const payload = (await response.json()) as {
          error?: string;
          message?: string;
          organizationId?: string;
        };

        if (!response.ok) {
          setOrganizationFeedback({
            error: payload.error ?? "Unable to save organization settings.",
          });
          return;
        }

        onSuccess(payload);
        router.refresh();
      } catch {
        setOrganizationFeedback({
          error: "Unable to save organization settings right now.",
        });
      }
    });
  }

  function submitUserForm() {
    const payload = {
      firstName: formState.firstName,
      lastName: formState.lastName,
      email: formState.email,
      password: formState.password,
      isCandidate: formState.isCandidate,
      isMentor: formState.isMentor,
      adminRole: formState.adminRole,
      status: formState.status,
    };

    if (composerMode === "create") {
      runAction(
        "/api/admin/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "create",
            organizationId: selectedOrganizationId,
            ...payload,
          }),
        },
        (result) => {
          setFeedback({ message: result.message });
          closeComposer();
        },
      );
      return;
    }

    if (composerMode === "invite") {
      runAction(
        "/api/admin/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "invite",
            organizationId: selectedOrganizationId,
            firstName: formState.firstName,
            lastName: formState.lastName,
            email: formState.email,
            isCandidate: formState.isCandidate,
            isMentor: formState.isMentor,
            adminRole: formState.adminRole,
          }),
        },
        (result) => {
          setFeedback({ message: result.message });
          closeComposer();
        },
      );
      return;
    }

    if (composerMode === "edit" && selectedUser) {
      runAction(
        "/api/admin/users",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "edit",
            organizationId: selectedOrganizationId,
            userId: selectedUser.id,
            ...payload,
          }),
        },
        (result) => {
          setFeedback({ message: result.message });
          closeComposer();
        },
      );
    }
  }

  function changeStatus(userId: string, status: OrganizationUserStatus) {
    runAction(
      "/api/admin/users",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          organizationId: selectedOrganizationId,
          userId,
          status,
        }),
      },
      (result) => {
        setFeedback({ message: result.message });
      },
    );
  }

  function submitPasswordAction() {
    if (!selectedUser) {
      return;
    }

    runAction(
      "/api/admin/users",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          organizationId: selectedOrganizationId,
          userId: selectedUser.id,
          temporaryPassword: formState.temporaryPassword || undefined,
        }),
      },
      (result) => {
        setFeedback({
          message: result.message,
          resetLink: result.resetLink,
        });
        closeComposer();
      },
    );
  }

  function deleteUser(user: AdministrationUser) {
    runAction(
      `/api/admin/users?userId=${encodeURIComponent(user.id)}&organizationId=${encodeURIComponent(selectedOrganizationId)}`,
      { method: "DELETE" },
      (result) => {
        setFeedback({ message: result.message });
      },
    );
  }

  function submitOrganizationUpdate() {
    if (!selectedOrganization) {
      return;
    }

    runOrganizationAction(
      "/api/admin/organizations",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrganization.id,
          ...organizationForm,
        }),
      },
      (result) => {
        setOrganizationFeedback({ message: result.message });
      },
    );
  }

  function createOrganization() {
    runOrganizationAction(
      "/api/admin/organizations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrganizationForm),
      },
      (result) => {
        setOrganizationFeedback({ message: result.message });
        setNewOrganizationForm({
          organizationName: "",
          industryName: "",
          billingContactEmail: "",
          subscriptionStatus: "active",
          leadershipContinuityEnabled: true,
          leadershipContinuityTier: "organization",
          leadershipHelpEnabled: false,
          leadershipHelpTier: "none",
        });
        if (result.organizationId) {
          window.location.assign(
            `/administration?organizationId=${encodeURIComponent(result.organizationId)}`,
          );
        }
      },
    );
  }

  return (
    <>
      {selectedOrganization && activeTab === "organization-controls" ? (
        <section className="theme-panel-strong rounded-[2rem] p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Organization Controls
              </p>
              <h2 className="mt-3 font-display text-3xl text-slate-900">
                {selectedOrganization.name}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                Choose the active company, update product access, and control which
                modules are enabled. System Admin can manage every company from this
                surface.
              </p>
            </div>

            <div className="grid gap-3 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-4 text-sm text-slate-700 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div>
                <span className="font-semibold text-slate-950">Industry:</span>{" "}
                {selectedOrganization.industry || "Not set"}
              </div>
              <div>
                <span className="font-semibold text-slate-950">Continuity:</span>{" "}
                {selectedOrganization.leadership_continuity_enabled
                  ? selectedOrganization.leadership_continuity_tier
                  : "Disabled"}
              </div>
              <div>
                <span className="font-semibold text-slate-950">Personal Development:</span>{" "}
                {selectedOrganization.leadership_help_enabled
                  ? selectedOrganization.leadership_help_tier
                  : "Disabled"}
              </div>
            </div>
          </div>

          {organizationFeedback.error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
              {organizationFeedback.error}
            </div>
          ) : null}

          {organizationFeedback.message ? (
            <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm font-medium text-teal-800">
              {organizationFeedback.message}
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-[1.5rem] border border-slate-200/80 bg-white/70 p-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Active organization
                </span>
                <select
                  value={selectedOrganizationId}
                  onChange={(event) =>
                    window.location.assign(
                      `/administration?organizationId=${encodeURIComponent(event.target.value)}${organizationSectionSuffix}`,
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Organization name
                  </span>
                  <input
                    value={organizationForm.organizationName}
                    onChange={(event) =>
                      setOrganizationForm((current) => ({
                        ...current,
                        organizationName: event.target.value,
                      }))
                    }
                    disabled={!canEditOrganizationAccess}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                    type="text"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Industry
                  </span>
                  <input
                    value={organizationForm.industryName}
                    onChange={(event) =>
                      setOrganizationForm((current) => ({
                        ...current,
                        industryName: event.target.value,
                      }))
                    }
                    disabled={!canEditOrganizationAccess}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                    type="text"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Billing contact
                  </span>
                  <input
                    value={organizationForm.billingContactEmail}
                    onChange={(event) =>
                      setOrganizationForm((current) => ({
                        ...current,
                        billingContactEmail: event.target.value,
                      }))
                    }
                    disabled={!canEditOrganizationAccess}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                    type="email"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Subscription status
                  </span>
                  <select
                    value={organizationForm.subscriptionStatus}
                    onChange={(event) =>
                      setOrganizationForm((current) => ({
                        ...current,
                        subscriptionStatus: event.target.value,
                      }))
                    }
                    disabled={!canEditOrganizationAccess}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="trialing">Trialing</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past due</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <fieldset className="rounded-[1.25rem] border border-slate-200 bg-white/80 p-4">
                  <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
                    <input
                      checked={organizationForm.leadershipContinuityEnabled}
                      onChange={(event) =>
                        setOrganizationForm((current) => ({
                          ...current,
                          leadershipContinuityEnabled: event.target.checked,
                        }))
                      }
                      disabled={!canEditOrganizationAccess}
                      type="checkbox"
                    />
                    Leadership Continuity
                  </label>
                  <input
                    value={organizationForm.leadershipContinuityTier}
                    onChange={(event) =>
                      setOrganizationForm((current) => ({
                        ...current,
                        leadershipContinuityTier: event.target.value,
                      }))
                    }
                    disabled={!canEditOrganizationAccess}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                    type="text"
                    placeholder="organization"
                  />
                </fieldset>

                <fieldset className="rounded-[1.25rem] border border-slate-200 bg-white/80 p-4">
                  <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
                    <input
                      checked={organizationForm.leadershipHelpEnabled}
                      onChange={(event) =>
                        setOrganizationForm((current) => ({
                          ...current,
                          leadershipHelpEnabled: event.target.checked,
                        }))
                      }
                      disabled={!canEditOrganizationAccess}
                      type="checkbox"
                    />
                    Personal Development
                  </label>
                  <input
                    value={organizationForm.leadershipHelpTier}
                    onChange={(event) =>
                      setOrganizationForm((current) => ({
                        ...current,
                        leadershipHelpTier: event.target.value,
                      }))
                    }
                    disabled={!canEditOrganizationAccess}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                    type="text"
                    placeholder="none"
                  />
                </fieldset>
              </div>

              {canEditOrganizationAccess ? (
                <button
                  type="button"
                  onClick={submitOrganizationUpdate}
                  disabled={isPending}
                  className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Save Organization Access"}
                </button>
              ) : (
                <p className="text-sm text-slate-500">
                  Organization access settings are managed by an administrator for this organization.
                </p>
              )}
            </div>

            {canCreateOrganizations ? (
              <div className="space-y-4 rounded-[1.5rem] border border-slate-200/80 bg-white/70 p-5">
                <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Create Company
                </p>
                <h3 className="font-display text-2xl text-slate-950">
                  Set up a new company
                </h3>
                <div className="grid gap-4">
                  <input
                    value={newOrganizationForm.organizationName}
                    onChange={(event) =>
                      setNewOrganizationForm((current) => ({
                        ...current,
                        organizationName: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                    type="text"
                    placeholder="Organization name"
                  />
                  <input
                    value={newOrganizationForm.industryName}
                    onChange={(event) =>
                      setNewOrganizationForm((current) => ({
                        ...current,
                        industryName: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                    type="text"
                    placeholder="Industry"
                  />
                  <input
                    value={newOrganizationForm.billingContactEmail}
                    onChange={(event) =>
                      setNewOrganizationForm((current) => ({
                        ...current,
                        billingContactEmail: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                    type="email"
                    placeholder="billing@company.com"
                  />
                  <select
                    value={newOrganizationForm.subscriptionStatus}
                    onChange={(event) =>
                      setNewOrganizationForm((current) => ({
                        ...current,
                        subscriptionStatus: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  >
                    <option value="trialing">Trialing</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past due</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <fieldset className="rounded-[1.25rem] border border-slate-200 bg-white/80 p-4">
                    <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
                      <input
                        checked={newOrganizationForm.leadershipContinuityEnabled}
                        onChange={(event) =>
                          setNewOrganizationForm((current) => ({
                            ...current,
                            leadershipContinuityEnabled: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      Leadership Continuity
                    </label>
                    <input
                      value={newOrganizationForm.leadershipContinuityTier}
                      onChange={(event) =>
                        setNewOrganizationForm((current) => ({
                          ...current,
                          leadershipContinuityTier: event.target.value,
                        }))
                      }
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      type="text"
                    />
                  </fieldset>
                  <fieldset className="rounded-[1.25rem] border border-slate-200 bg-white/80 p-4">
                    <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
                      <input
                        checked={newOrganizationForm.leadershipHelpEnabled}
                        onChange={(event) =>
                          setNewOrganizationForm((current) => ({
                            ...current,
                            leadershipHelpEnabled: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      Personal Development
                    </label>
                    <input
                      value={newOrganizationForm.leadershipHelpTier}
                      onChange={(event) =>
                        setNewOrganizationForm((current) => ({
                          ...current,
                          leadershipHelpTier: event.target.value,
                        }))
                      }
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      type="text"
                    />
                  </fieldset>
                </div>
                <button
                  type="button"
                  onClick={createOrganization}
                  disabled={isPending}
                  className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Creating..." : "Create Company"}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "assign-mentors" ? (
        <section className="grid gap-6">
          <section className="theme-panel-strong rounded-[2rem] p-8">
            <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Assign Mentors
            </p>
            <h2 className="mt-3 font-display text-3xl text-slate-900">
              Tie candidate-role tracks to the right mentor
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              Use this tab to create the role-based mentoring assignment before
              development records, reports, and worksheet work begin.
            </p>
          </section>

          <MentorAssignmentManager
            candidates={mentorAssignmentOptions.candidates}
            roles={mentorAssignmentOptions.roles}
            mentors={mentorAssignmentOptions.mentors}
          />
        </section>
      ) : activeTab === "user-access" ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Active Candidates"
              value={summary.activeCandidates}
              tone="border-teal-200 bg-teal-50/85 text-teal-900"
              isActive={activeSummaryFilter === "active-candidates"}
              onClick={() => activateSummaryFilter("active-candidates")}
            />
            <SummaryCard
              label="Active Mentors"
              value={summary.activeMentors}
              tone="border-sky-200 bg-sky-50/85 text-sky-900"
              isActive={activeSummaryFilter === "active-mentors"}
              onClick={() => activateSummaryFilter("active-mentors")}
            />
            <SummaryCard
              label="Suspended Users"
              value={summary.suspendedUsers}
              tone="border-rose-200 bg-rose-50/85 text-rose-900"
              isActive={activeSummaryFilter === "suspended-users"}
              onClick={() => activateSummaryFilter("suspended-users")}
            />
            <SummaryCard
              label="Pending Invitations"
              value={summary.pendingInvitations}
              tone="border-amber-200 bg-amber-50/85 text-amber-900"
              isActive={activeSummaryFilter === "pending-invitations"}
              onClick={() => activateSummaryFilter("pending-invitations")}
            />
          </section>

          <section
            ref={filtersSectionRef}
            className="theme-panel-strong rounded-[2rem] p-8"
          >
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Search And Filters
                </p>
                <h2 className="mt-3 font-display text-3xl text-slate-900">
                  Manage access without losing history
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                  Suspended and archived users keep their scores, reports, interview
                  results, assignments, and development history. Permanent deletion is
                  blocked whenever historical program data exists.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openComposer("create")}
                  className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
                >
                  Add User
                </button>
                <button
                  type="button"
                  onClick={() => openComposer("invite")}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:text-teal-900"
                >
                  Invite User
                </button>
              </div>
            </div>

            {feedback.error ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">
                {feedback.error}
              </div>
            ) : null}

            {feedback.message ? (
              <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm font-medium text-teal-800">
                <p>{feedback.message}</p>
                {feedback.resetLink ? (
                  <p className="mt-2 break-all text-xs text-teal-700">
                    {feedback.resetLink}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Name
                </span>
                <input
                  value={nameFilter}
                  onChange={(event) => setNameFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  type="text"
                  placeholder="Search by first or last name"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Email
                </span>
                <input
                  value={emailFilter}
                  onChange={(event) => setEmailFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                  type="text"
                  placeholder="Search by email"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {toggleFilters.map((filter) => (
                <button
                  key={filter.label}
                  type="button"
                  onClick={() => filter.setValue(!filter.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    filter.value
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:text-teal-900"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </section>

          <section className="theme-panel-strong overflow-hidden rounded-[2rem]">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-white/60 text-left text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">User Type</th>
                    <th className="px-6 py-4">Admin Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Last Login</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-sm text-slate-500"
                      >
                        No users match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-slate-200/70 bg-white/30 align-top text-sm text-slate-700 last:border-b-0"
                      >
                        <td className="px-6 py-5">
                          <p className="font-semibold text-slate-950">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Created {formatDate(user.created_at)}
                          </p>
                        </td>
                        <td className="px-6 py-5">{user.email}</td>
                        <td className="px-6 py-5">
                          {getUserTypeLabel({
                            isCandidate: user.is_candidate,
                            isMentor: user.is_mentor,
                          })}
                        </td>
                        <td className="px-6 py-5">
                          {getAdminRoleLabel(user.admin_role)}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getBadgeClassName(user.status)}`}
                          >
                            {getStatusLabel(user.status)}
                          </span>
                          {user.hasHistoricalData ? (
                            <p className="mt-2 text-xs text-slate-500">History retained</p>
                          ) : (
                            <p className="mt-2 text-xs text-slate-500">
                              No linked program history
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-5">{formatDate(user.last_login_at)}</td>
                        <td className="px-6 py-5">
                          <details className="relative">
                        <summary className="inline-flex cursor-pointer list-none rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:text-teal-900">
                          Actions
                        </summary>
                        <div className="absolute right-0 z-20 mt-3 grid min-w-60 gap-2 rounded-[1.5rem] border border-white/80 bg-white/95 p-3 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur">
                          <button
                            type="button"
                            onClick={() => openComposer("edit", user)}
                            className="rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                          >
                            Edit user
                          </button>
                          <button
                            type="button"
                            onClick={() => openComposer("password", user)}
                            className="rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                          >
                            Reset password
                          </button>
                          <button
                            type="button"
                            onClick={() => openComposer("edit", user)}
                            className="rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                          >
                            Change role
                          </button>
                          {user.status !== "suspended" ? (
                            <button
                              type="button"
                              onClick={() => changeStatus(user.id, "suspended")}
                              className="rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                            >
                              Suspend user
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => changeStatus(user.id, "active")}
                              className="rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                            >
                              Reactivate user
                            </button>
                          )}
                          {user.status !== "archived" ? (
                            <button
                              type="button"
                              onClick={() => changeStatus(user.id, "archived")}
                              className="rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                            >
                              Archive user
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => deleteUser(user)}
                            disabled={user.hasHistoricalData || isPending}
                            className="rounded-2xl px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            Delete user
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          </section>
        </>
      ) : null}

      {composerMode ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <div className="theme-panel-strong max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  {composerMode === "create"
                    ? "Add User"
                    : composerMode === "invite"
                      ? "Invite User"
                      : composerMode === "edit"
                        ? "Edit User"
                        : "Reset Password"}
                </p>
                <h3 className="mt-3 font-display text-3xl text-slate-950">
                  {composerMode === "password"
                    ? `Password controls for ${selectedUser?.first_name ?? "user"}`
                    : composerMode === "invite"
                      ? "Send a guided invitation"
                      : "Manage account details"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:text-teal-900"
              >
                Close
              </button>
            </div>

            {composerMode === "password" ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm leading-7 text-slate-600">
                  Leave the field empty to generate a reset workflow. Add a
                  temporary password if you want to change it immediately.
                </p>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Temporary password
                  </span>
                  <input
                    value={formState.temporaryPassword}
                    onChange={(event) =>
                      updateField("temporaryPassword", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                    type="password"
                    placeholder="Leave blank to send a reset flow"
                  />
                </label>
                <button
                  type="button"
                  onClick={submitPasswordAction}
                  disabled={isPending}
                  className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Working..." : "Apply password action"}
                </button>
              </div>
            ) : (
              <form
                className="mt-6 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitUserForm();
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      First name
                    </span>
                    <input
                      value={formState.firstName}
                      onChange={(event) => updateField("firstName", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      type="text"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Last name
                    </span>
                    <input
                      value={formState.lastName}
                      onChange={(event) => updateField("lastName", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      type="text"
                      required
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Email
                  </span>
                  <input
                    value={formState.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                    type="email"
                    required
                  />
                </label>

                {composerMode === "create" ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Password
                    </span>
                    <input
                      value={formState.password}
                      onChange={(event) => updateField("password", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      type="password"
                      minLength={8}
                      required
                    />
                  </label>
                ) : null}

                <fieldset className="rounded-[1.5rem] border border-slate-200 bg-white/70 p-5">
                  <legend className="px-2 text-sm font-semibold text-slate-700">
                    User type
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                      <input
                        checked={formState.isCandidate}
                        onChange={(event) =>
                          updateField("isCandidate", event.target.checked)
                        }
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                      />
                      Candidate
                    </label>
                    <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                      <input
                        checked={formState.isMentor}
                        onChange={(event) => updateField("isMentor", event.target.checked)}
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                      />
                      Mentor
                    </label>
                  </div>
                </fieldset>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Admin role
                    </span>
                    <select
                      value={formState.adminRole}
                      onChange={(event) =>
                        updateField(
                          "adminRole",
                          event.target.value as OrganizationUserAdminRole,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                    >
                      {adminRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {composerMode === "invite" ? (
                    <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                      Invitations are always created with the
                      {" "}
                      <span className="font-semibold">Invited</span>
                      {" "}
                      status until the user completes setup.
                    </div>
                  ) : (
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Status
                      </span>
                      <select
                        value={formState.status}
                        onChange={(event) =>
                          updateField(
                            "status",
                            event.target.value as OrganizationUserStatus,
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="interactive-contrast rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending
                    ? "Saving..."
                    : composerMode === "invite"
                      ? "Send Invitation"
                      : composerMode === "edit"
                        ? "Save Changes"
                        : "Add User"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
