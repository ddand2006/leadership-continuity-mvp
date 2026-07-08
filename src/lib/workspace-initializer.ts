import {
  demoCandidateRanking,
  demoInterviewQuestions,
  demoInterviewScores,
  demoRole,
  developmentProjects,
  strengthsLibrary,
} from "@/lib/bootstrap-data";
import { isMissingOrganizationIndustryColumnError } from "@/lib/organization-industry";
import { normalizeEmail } from "@/lib/organization-users";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function requireData<T>(data: T | null, message: string) {
  if (!data) {
    throw new Error(message);
  }

  return data;
}

export async function initializeWorkspaceForUser(options: {
  userId: string;
  email: string;
  fullName: string;
  organizationName: string;
  industryName: string;
  seedDemoData?: boolean;
}) {
  console.log("initializeWorkspace:start");
  const admin = createSupabaseAdminClient();
  const {
    userId,
    email,
    fullName,
    organizationName,
    industryName,
    seedDemoData = false,
  } = options;
  const trimmedName = fullName.trim();
  const [firstName, ...remainingNameParts] = trimmedName.split(/\s+/);
  const lastName = remainingNameParts.join(" ") || "Admin";

  console.log("initializeWorkspace:user", {
    userId,
    email,
    organizationName,
    industryName,
  });

  const existingProfileResult = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  console.log("initializeWorkspace:profileLookup");

  if (existingProfileResult.error) {
    throw new Error(existingProfileResult.error.message);
  }

  if (existingProfileResult.data) {
    throw new Error("Workspace is already initialized for this user.");
  }

  let supportsOrganizationIndustry = true;
  let existingOrganizationResult = await admin
    .from("organizations")
    .select("id, industry")
    .eq("name", organizationName)
    .maybeSingle();

  if (isMissingOrganizationIndustryColumnError(existingOrganizationResult.error)) {
    supportsOrganizationIndustry = false;
    existingOrganizationResult = await admin
      .from("organizations")
      .select("id")
      .eq("name", organizationName)
      .maybeSingle();
  }

  if (existingOrganizationResult.error) {
    throw new Error(existingOrganizationResult.error.message);
  }

  let organizationId = existingOrganizationResult.data?.id;
  const existingOrganizationData = existingOrganizationResult.data as
    | { id: string; industry?: string | null }
    | null;
  const existingOrganizationIndustry = supportsOrganizationIndustry
    ? existingOrganizationData?.industry ?? null
    : null;

  if (!organizationId) {
    console.log("initializeWorkspace:createOrganization");
    const organizationInsertResult = await admin
      .from("organizations")
      .insert(
        supportsOrganizationIndustry
          ? { name: organizationName, industry: industryName }
          : { name: organizationName },
      )
      .select("id")
      .single();

    if (organizationInsertResult.error) {
      throw new Error(organizationInsertResult.error.message);
    }

    organizationId = requireData(
      organizationInsertResult.data,
      "Organization creation returned no data.",
    ).id;
  } else if (supportsOrganizationIndustry && !existingOrganizationIndustry?.trim()) {
    const organizationUpdateResult = await admin
      .from("organizations")
      .update({ industry: industryName })
      .eq("id", organizationId);

    if (organizationUpdateResult.error) {
      throw new Error(organizationUpdateResult.error.message);
    }
  }

  const profileInsertResult = await admin
    .from("profiles")
    .insert({
      auth_user_id: userId,
      organization_id: organizationId,
      full_name: trimmedName,
      email: normalizeEmail(email),
      role: "system_admin",
    })
    .select("id")
    .single();
  console.log("initializeWorkspace:profileInsert");

  if (profileInsertResult.error) {
    throw new Error(profileInsertResult.error.message);
  }

  const adminProfileId = requireData(
    profileInsertResult.data,
    "Profile creation returned no data.",
  ).id;

  const organizationUserInsertResult = await admin.from("organization_users").insert({
    organization_id: organizationId,
    auth_user_id: userId,
    profile_id: adminProfileId,
    first_name: firstName || "Admin",
    last_name: lastName,
    email: normalizeEmail(email),
    admin_role: "ceo_admin",
    status: "active",
    activated_at: new Date().toISOString(),
    created_by_profile_id: adminProfileId,
    updated_by_profile_id: adminProfileId,
  });

  if (organizationUserInsertResult.error) {
    throw new Error(organizationUserInsertResult.error.message);
  }

  const strengthsResult = await admin
    .from("strengths_library")
    .upsert(strengthsLibrary, { onConflict: "theme_name" });

  if (strengthsResult.error) {
    throw new Error(strengthsResult.error.message);
  }

  const existingProjectTitlesResult = await admin
    .from("development_projects")
    .select("title")
    .is("organization_id", null);

  if (existingProjectTitlesResult.error) {
    throw new Error(existingProjectTitlesResult.error.message);
  }

  const existingProjectTitles = new Set(
    (existingProjectTitlesResult.data ?? []).map((project) => project.title),
  );

  const missingProjects = developmentProjects
    .filter((project) => !existingProjectTitles.has(project.title))
    .map((project) => ({
      organization_id: null,
      ...project,
    }));

  if (missingProjects.length > 0) {
    const projectsInsertResult = await admin
      .from("development_projects")
      .insert(missingProjects);

    if (projectsInsertResult.error) {
      throw new Error(projectsInsertResult.error.message);
    }
  }

  if (!seedDemoData) {
    console.log("initializeWorkspace:complete_without_demo_data");
    return "Workspace initialized with your admin profile. No demo candidate data was added.";
  }

  let roleId: string;
  const existingRoleResult = await admin
    .from("roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("title", demoRole.title)
    .maybeSingle();

  if (existingRoleResult.error) {
    throw new Error(existingRoleResult.error.message);
  }

  if (existingRoleResult.data) {
    roleId = existingRoleResult.data.id;
  } else {
    const roleInsertResult = await admin
      .from("roles")
      .insert({
        organization_id: organizationId,
        title: demoRole.title,
        department: demoRole.department,
        description: demoRole.description,
        status: "active",
      })
      .select("id")
      .single();

    if (roleInsertResult.error) {
      throw new Error(roleInsertResult.error.message);
    }

    roleId = requireData(
      roleInsertResult.data,
      "Role creation returned no data.",
    ).id;
  }

  const existingCompetenciesResult = await admin
    .from("role_competencies")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("role_id", roleId);

  if (existingCompetenciesResult.error) {
    throw new Error(existingCompetenciesResult.error.message);
  }

  const competencyMap = new Map(
    (existingCompetenciesResult.data ?? []).map((competency) => [
      competency.name,
      competency.id,
    ]),
  );

  const missingCompetencies = demoRole.competencies
    .filter((competency) => !competencyMap.has(competency.name))
    .map((competency) => ({
      organization_id: organizationId,
      role_id: roleId,
      ...competency,
    }));

  if (missingCompetencies.length > 0) {
    const competenciesInsertResult = await admin
      .from("role_competencies")
      .insert(missingCompetencies)
      .select("id, name");

    if (competenciesInsertResult.error) {
      throw new Error(competenciesInsertResult.error.message);
    }

    for (const competency of requireData(
      competenciesInsertResult.data,
      "Competency creation returned no data.",
    )) {
      competencyMap.set(competency.name, competency.id);
    }
  }

  const existingQuestionsResult = await admin
    .from("interview_questions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("role_id", roleId);

  if (existingQuestionsResult.error) {
    throw new Error(existingQuestionsResult.error.message);
  }

  if ((existingQuestionsResult.data ?? []).length === 0) {
    const questionsInsertResult = await admin.from("interview_questions").insert(
      demoInterviewQuestions.map((question) => ({
        organization_id: organizationId,
        role_id: roleId,
        competency_id: competencyMap.get(question.competency_name),
        question: question.question,
        scoring_rubric: question.scoring_rubric,
      })),
    );

    if (questionsInsertResult.error) {
      throw new Error(questionsInsertResult.error.message);
    }
  }

  let candidateId: string;
  const existingCandidateResult = await admin
    .from("candidates")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("full_name", "Erin Demo")
    .maybeSingle();

  if (existingCandidateResult.error) {
    throw new Error(existingCandidateResult.error.message);
  }

  if (existingCandidateResult.data) {
    candidateId = existingCandidateResult.data.id;
  } else {
    const candidateInsertResult = await admin
      .from("candidates")
      .insert({
        organization_id: organizationId,
        full_name: "Erin Demo",
        current_title: "Director of Operations",
        target_role_id: roleId,
        mentor_profile_id: adminProfileId,
        status: "active",
      })
      .select("id")
      .single();

    if (candidateInsertResult.error) {
      throw new Error(candidateInsertResult.error.message);
    }

    candidateId = requireData(
      candidateInsertResult.data,
      "Candidate creation returned no data.",
    ).id;
  }

  const strengthsByTheme = new Map(
    strengthsLibrary.map((strength) => [strength.theme_name, strength.domain]),
  );

  const existingCandidateStrengthsResult = await admin
    .from("candidate_strengths")
    .select("id")
    .eq("candidate_id", candidateId);

  if (existingCandidateStrengthsResult.error) {
    throw new Error(existingCandidateStrengthsResult.error.message);
  }

  if ((existingCandidateStrengthsResult.data ?? []).length === 0) {
    const candidateStrengthsInsertResult = await admin
      .from("candidate_strengths")
      .insert(
        demoCandidateRanking.map((themeName, index) => ({
          organization_id: organizationId,
          candidate_id: candidateId,
          theme_name: themeName,
          rank: index + 1,
          domain: strengthsByTheme.get(themeName) ?? "Strategic Thinking",
          notes:
            index < 10
              ? "Primary leverage strength for development planning."
              : index < 20
                ? "Supporting strength that can reinforce growth work."
                : "Lower-energy theme that may require deliberate stretch support.",
        })),
      );

    if (candidateStrengthsInsertResult.error) {
      throw new Error(candidateStrengthsInsertResult.error.message);
    }
  }

  const considerationSeedResult = await admin
    .from("candidate_role_considerations")
    .upsert(
      {
        organization_id: organizationId,
        candidate_id: candidateId,
        role_id: roleId,
        status: "active",
        is_primary: true,
      },
      { onConflict: "candidate_id,role_id" },
    );

  if (considerationSeedResult.error) {
    throw new Error(considerationSeedResult.error.message);
  }

  const mentorAssignmentSeedResult = await admin
    .from("mentor_role_assignments")
    .upsert(
      {
        organization_id: organizationId,
        candidate_id: candidateId,
        role_id: roleId,
        mentor_profile_id: adminProfileId,
        status: "active",
      },
      { onConflict: "candidate_id,role_id,mentor_profile_id" },
    );

  if (mentorAssignmentSeedResult.error) {
    throw new Error(mentorAssignmentSeedResult.error.message);
  }

  let panelId: string;
  const existingPanelResult = await admin
    .from("interview_panels")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("candidate_id", candidateId)
    .eq("panel_name", "Demo Completed Panel")
    .maybeSingle();

  if (existingPanelResult.error) {
    throw new Error(existingPanelResult.error.message);
  }

  if (existingPanelResult.data) {
    panelId = existingPanelResult.data.id;
  } else {
    const panelInsertResult = await admin
      .from("interview_panels")
      .insert({
        organization_id: organizationId,
        role_id: roleId,
        candidate_id: candidateId,
        panel_name: "Demo Completed Panel",
        date_completed: "2026-06-15",
      })
      .select("id")
      .single();

    if (panelInsertResult.error) {
      throw new Error(panelInsertResult.error.message);
    }

    panelId = requireData(
      panelInsertResult.data,
      "Interview panel creation returned no data.",
    ).id;
  }

  const existingScoresResult = await admin
    .from("interview_scores")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("panel_id", panelId);

  if (existingScoresResult.error) {
    throw new Error(existingScoresResult.error.message);
  }

  if ((existingScoresResult.data ?? []).length === 0) {
    const scoresInsertResult = await admin.from("interview_scores").insert(
      demoInterviewScores.map((score) => ({
        organization_id: organizationId,
        panel_id: panelId,
        interviewer_profile_id: adminProfileId,
        competency_id: competencyMap.get(score.competency_name),
        score_numeric: score.score_numeric,
        evidence_notes: score.evidence_notes,
        concern_notes: score.concern_notes,
      })),
    );

    if (scoresInsertResult.error) {
      throw new Error(scoresInsertResult.error.message);
    }
  }

  console.log("initializeWorkspace:complete");
  return "Workspace initialized with your admin profile and demo organization data.";
}
