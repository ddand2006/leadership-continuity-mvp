import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { AccountMenu } from "@/components/account-menu";
import { AppNavLinks } from "@/components/app-nav-links";
import { getCurrentUser } from "@/lib/auth";
import { canAccessLeadershipHelpPreview } from "@/lib/leadership-help-preview";
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
    matchPath: "/about",
  },
  {
    href: "/outside-training",
    label: "Outside Training",
    matchPath: "/outside-training",
  },
  {
    href: "/mentoring?section=preparation-worksheet",
    label: "Preparation Worksheet",
    matchPath: "/mentoring",
    matchSection: "preparation-worksheet",
  },
  {
    href: "/mentoring?section=departmental-project",
    label: "Departmental Project",
    matchPath: "/mentoring",
    matchSection: "departmental-project",
  },
  {
    href: "/mentoring?section=cross-departmental-project",
    label: "Cross-Departmental Project",
    matchPath: "/mentoring",
    matchSection: "cross-departmental-project",
  },
];

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
  let hasLeadershipHelpPreviewAccess = false;

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
      hasLeadershipHelpPreviewAccess = canAccessLeadershipHelpPreview({
        email: user.email,
        organizationId: profileResult.data.organization_id,
        role: profileResult.data.role,
      });
    }
  }

  const navItems = user
    ? [
        { href: "/", label: "Home" },
        ...(hasContinuityAccess && isAdmin ? [{ href: "/roles", label: "Roles" }] : []),
        ...(hasContinuityAccess ? [{ href: "/candidates", label: "Candidates" }] : []),
        ...(hasContinuityAccess && (isAdmin || isMentor || isCandidate)
          ? [{ href: "/mentoring", label: "Mentoring" }]
          : []),
        ...(hasContinuityAccess && (isAdmin || isMentor)
          ? [{ href: "/dashboard", label: "Dashboard" }]
          : []),
        ...(hasContinuityAccess && isAdmin
          ? [{ href: "/360-review", label: "360 Review" }]
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
  const trailingNavItems =
    user && hasLeadershipHelpAccess && hasLeadershipHelpPreviewAccess
      ? [{ href: "/personal-development", label: "Personal Development" }]
      : [];
  const accountLandingHref = hasContinuityAccess
    ? isAdmin || isMentor
      ? "/dashboard"
      : "/candidates"
    : isSystemAdmin
      ? "/administration"
    : hasLeadershipHelpAccess && hasLeadershipHelpPreviewAccess
      ? "/personal-development"
      : "/subscribe";
  const accountLandingLabel =
    isSystemAdmin && !hasContinuityAccess
      ? "Open Administration"
      : hasLeadershipHelpAccess &&
          hasLeadershipHelpPreviewAccess &&
          !hasContinuityAccess
      ? "Open Personal Development"
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
              <AccountMenu
                initials={getInitials(user)}
                displayName={getDisplayName(user)}
                email={user.email ?? null}
                accountLandingHref={accountLandingHref}
                accountLandingLabel={accountLandingLabel}
              />
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

          <AppNavLinks
            initialPathname={pathname}
            navItems={navItems}
            resourceNavItems={resourceNavItems}
            showResources={hasContinuityAccess && (isAdmin || isMentor)}
            trailingNavItems={trailingNavItems}
          />
        </div>
      </div>
    </header>
  );
}
