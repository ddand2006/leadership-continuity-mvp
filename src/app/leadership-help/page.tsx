import { CoachingSupportManager } from "@/components/coaching-support-manager";
import {
  isMissingCoachingRequestsTableError,
  parseCoachingGuidance,
  type CoachingRequestRecord,
} from "@/lib/coaching-support";
import { hasOpenAIEnv } from "@/lib/env";
import { isAdminAppRole, isMentorAppUser } from "@/lib/mentor-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePaidWorkspaceProfile } from "@/lib/workspace";

type LeadershipHelpRequestRow = CoachingRequestRecord;

export default async function LeadershipHelpPage() {
  const { account, profile } = await requirePaidWorkspaceProfile({
    product: "leadership_help",
  });
  const admin = createSupabaseAdminClient();
  const canReviewQueue = isAdminAppRole(profile.role) || isMentorAppUser(profile, account);
  const requestsQuery = admin
    .from("coaching_requests")
    .select(
      "id, requester_profile_id, challenge_area, challenge_title, challenge_summary, organizational_context, desired_outcome, urgency, support_path, status, ai_guidance, ai_generated_at, assigned_coach_name, internal_notes, last_reviewed_at, created_at, updated_at",
    )
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  if (!canReviewQueue) {
    requestsQuery.eq("requester_profile_id", profile.id);
  }

  const requestsResult = await requestsQuery;

  if (requestsResult.error && !isMissingCoachingRequestsTableError(requestsResult.error)) {
    throw new Error(requestsResult.error.message);
  }

  const requesterIds = Array.from(
    new Set((requestsResult.data ?? []).map((request) => request.requester_profile_id)),
  );
  const profilesResult =
    requesterIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", requesterIds)
      : { data: [], error: null };

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((item) => [item.id, item]),
  );
  const requests = ((requestsResult.data ?? []) as LeadershipHelpRequestRow[]).map(
    (request) => ({
      ...request,
      ai_guidance: parseCoachingGuidance(request.ai_guidance),
      requesterName:
        profileMap.get(request.requester_profile_id)?.full_name ?? "Team member",
      requesterEmail: profileMap.get(request.requester_profile_id)?.email ?? null,
    }),
  );

  return (
    <main className="px-5 pb-16 pt-8 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1380px]">
        {isMissingCoachingRequestsTableError(requestsResult.error) ? (
          <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 text-amber-950 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold tracking-[0.16em] uppercase">
              Leadership Help
            </p>
            <h1 className="mt-3 font-display text-3xl">
              The Leadership Help database migration still needs to be applied
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7">
              The interface is ready, but the `coaching_requests` table has not been
              created in Supabase yet. Once that migration is applied, leaders can
              submit challenge-support requests, receive AI guidance, and request a
              human coach as part of this module.
            </p>
          </section>
        ) : (
          <CoachingSupportManager
            requests={requests}
            canReviewQueue={canReviewQueue}
            hasOpenAI={hasOpenAIEnv()}
          />
        )}
      </div>
    </main>
  );
}
