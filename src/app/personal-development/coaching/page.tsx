import { CoachingSupportManager } from "@/components/coaching-support-manager";
import { PersonalDevelopmentWorkspaceMenu } from "@/components/personal-development-workspace-menu";
import { loadPersonalDevelopmentCoachingData, loadPersonalDevelopmentWorkspaceData } from "@/lib/personal-development";
import { personalDevelopmentWorkspaceSections } from "@/lib/personal-development-sections";

export default async function PersonalDevelopmentCoachingPage() {
  const [workspace, coaching] = await Promise.all([
    loadPersonalDevelopmentWorkspaceData(),
    loadPersonalDevelopmentCoachingData(),
  ]);
  const detailItems = [
    `Current position: ${
      workspace.personalProfile?.current_position_title ??
      workspace.profilePositionTitle ??
      "Not entered"
    }`,
    `Role profile: ${
      workspace.roleProfile?.title ??
      (workspace.personalProfile ? "Needs role definition" : "Not started")
    }`,
    `Coaching requests on file: ${workspace.coachingRequestCount}`,
    `AI guidance: ${coaching.hasOpenAI ? "Available" : "OPENAI_API_KEY needed"}`,
  ];

  return (
    <main className="app-page">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-6 py-12 sm:px-10 lg:px-12">
        <PersonalDevelopmentWorkspaceMenu
          leaderName={workspace.profile.full_name}
          detailItems={detailItems}
          sections={personalDevelopmentWorkspaceSections}
          activeSectionId="coaching"
        />

        <CoachingSupportManager
          requests={coaching.requests}
          canReviewQueue={coaching.canReviewQueue}
          hasOpenAI={coaching.hasOpenAI}
        />
      </div>
    </main>
  );
}
