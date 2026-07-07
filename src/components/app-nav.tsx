import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import {
  isAdminAppRole,
  isCandidateAppUser,
  isMentorAppUser,
} from "@/lib/mentor-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  hasProductAccess,
  isPaywallEnabled,
  loadOrganizationSubscription,
  type OrganizationSubscriptionClient,
} from "@/lib/subscription";

const resourceNavItems = [
  {
    href: "/about",
    label: "The System",
  },
  {
    href: "/mentoring?section=preparation-worksheet",
    label: "Preparation Worksheet",
  },
  {
    href: "/mentoring?section=departmental-project",
    label: "Departmental Project",
  },
  {
    href: "/mentoring?section=cross-departmental-project",
    label: "Cross-Departmental Project",
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getDisplayName(user: User) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";

  if (metadataName) {
    return metadataName;
  }

  return user.email?.split("@")[0] ?? "Account";
}

function getInitials(user: User) {
  const displayName = getDisplayName(user);
  const parts = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "A";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export async function AppNav({ pathname }: { pathname: string }) {
  const user = await getCurrentUser();
  let isAdmin = false;
  let isSystemAdmin = false;
  let isMentor = false;
  let isCandidate = false;
  let isCandidateOnly = false;
  let hasContinuityAccess = true;
  let hasLeadershipHelpAccess = true;

  if (user) {
    const supabase = await createSupabaseServerClient();
    const [profileResult, accountResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, role, organization_id")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabase
        .from("organization_users")
        .select("candidate_id, is_candidate, is_mentor, admin_role, status")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      throw new Error(profileResult.error.message);
    }

    if (accountResult.error) {
      throw new Error(accountResult.error.message);
    }

    isAdmin = profileResult.data ? isAdminAppRole(profileResult.data.role) : false;
    isSystemAdmin = profileResult.data?.role === "system_admin";
    isMentor =
      profileResult.data && accountResult.data
        ? isMentorAppUser(profileResult.data, accountResult.data)
        : profileResult.data?.role === "mentor";
    isCandidate = isCandidateAppUser(accountResult.data);
    isCandidateOnly = Boolean(user && !isAdmin && !isMentor && isCandidate);

    if (profileResult.data) {
      const subscription = await loadOrganizationSubscription(
        supabase as unknown as OrganizationSubscriptionClient,
        profileResult.data.organization_id,
      );
      hasContinuityAccess = hasProductAccess(
        subscription,
        "leadership_continuity",
      );
      hasLeadershipHelpAccess = hasProductAccess(
        subscription,
        "leadership_help",
      );
    }
  }

  const navItems = user
    ? [
        { href: "/", label: "Home" },
        ...(hasContinuityAccess && isAdmin ? [{ href: "/roles", label: "Roles" }] : []),
        ...(hasContinuityAccess ? [{ href: "/candidates", label: "Candidates" }] : []),
        ...(hasLeadershipHelpAccess
          ? [{ href: "/leadership-help", label: "Leadership Help" }]
          : []),
        ...(hasContinuityAccess && (isAdmin || isMentor || isCandidate)
          ? [{ href: "/mentoring", label: "Mentoring" }]
          : []),
        ...(hasContinuityAccess && (isAdmin || isMentor)
          ? [{ href: "/dashboard", label: "Dashboard" }]
          : []),
        ...((hasContinuityAccess && isAdmin) || isSystemAdmin
          ? [{ href: "/administration", label: "Administration" }]
          : []),
        ...(isPaywallEnabled() ? [{ href: "/subscribe", label: "Access" }] : []),
      ]
    : [
        { href: "/", label: "Home" },
        ...(isPaywallEnabled() ? [{ href: "/subscribe", label: "Access" }] : []),
      ];
  const accountLandingHref = hasContinuityAccess
    ? isAdmin || isMentor
      ? "/dashboard"
      : "/candidates"
    : isSystemAdmin
      ? "/administration"
    : hasLeadershipHelpAccess
      ? "/leadership-help"
      : "/subscribe";
  const accountLandingLabel =
    isSystemAdmin && !hasContinuityAccess
      ? "Open Administration"
      : hasLeadershipHelpAccess && !hasContinuityAccess
      ? "Open Leadership Help"
      : isCandidateOnly
        ? "Open Candidates"
        : "Open Dashboard";

  return (
    <header className="relative z-10 px-5 pt-4 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1380px]">
        <div className="theme-panel-strong rounded-[2rem] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-950 font-display text-lg text-teal-50">
                LC
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-teal-700 uppercase">
                  Leadership Continuity
                </p>
                <p className="text-sm text-slate-600">
                  Organization succession planning MVP
                </p>
              </div>
            </Link>

            {user ? (
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 px-2 py-2 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition hover:border-teal-200 hover:text-teal-900">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-xs font-bold tracking-[0.16em] text-white">
                    {getInitials(user)}
                  </span>
                  <span className="hidden max-w-40 truncate sm:block">
                    {getDisplayName(user)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-slate-400 transition group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>

                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 hidden w-72 overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/95 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur group-open:block">
                  <div className="border-b border-slate-200/80 px-5 py-4">
                    <p className="text-sm font-semibold text-slate-950">
                      {getDisplayName(user)}
                    </p>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {user.email ?? "Signed in"}
                    </p>
                  </div>

                  <div className="grid gap-2 p-3">
                    <Link
                      href={accountLandingHref}
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                    >
                      {accountLandingLabel}
                    </Link>
                    <Link
                      href="/auth/logout"
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                    >
                      Sign Out
                    </Link>
                  </div>
                </div>
              </details>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth"
                  className="interactive-contrast rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>

          <nav className="mt-4 flex flex-wrap gap-2">
            {navItems.map((item) => {
              const isActive = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "interactive-contrast border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                      : "border-slate-200/80 bg-white/85 text-slate-700 hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {hasContinuityAccess && (isAdmin || isMentor) ? (
              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-900">
                  <span>Resources</span>
                  <span
                    aria-hidden="true"
                    className="text-slate-400 transition group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>

                <div className="absolute left-0 top-[calc(100%+0.75rem)] z-20 hidden min-w-72 overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/95 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur group-open:block">
                  <div className="grid gap-2 p-3">
                    {resourceNavItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}
