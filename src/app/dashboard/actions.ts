"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  demoCandidateRanking,
  demoInterviewQuestions,
  demoInterviewScores,
  demoRole,
  developmentProjects,
  strengthsLibrary,
} from "@/lib/bootstrap-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function redirectWithMessage(message: string) {
  redirect(`/dashboard?message=${encodeURIComponent(message)}`);
}

function getRequiredField(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing ${key}`);
  }

  return value.trim();
}

function requireData<T>(data: T | null, message: string) {
  if (!data) {
    throw new Error(message);
  }

  return data;
}

export async function initializeWorkspaceAction(formData: FormData) {
  console.log("initializeWorkspaceAction:start");
  const user = await requireUser();
  const fullName = getRequiredField(formData, "full_name");
  const organizationName = getRequiredField(formData, "organization_name");
  console.log("initializeWorkspaceAction:user", {
    userId: user.id,
    email: user.email,
    organizationName,
  });

  if (!user.email) {
    redirectWithMessage("Your authenticated user is missing an email address.");
  }

  const admin = createSupabaseAdminClient();

  const existingProfileResult = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  console.log("initializeWorkspaceAction:profileLookup");

  if (existingProfileResult.error) {
    redirectWithMessage(existingProfileResult.error.message);
  }

  if (existingProfileResult.data) {
    redirectWithMessage("Workspace is already initialized for this user.");
  }

  const existingOrganizationResult = await admin
    .from("organizations")
    .select("id")
    .eq("name", organizationName)
    .maybeSingle();

  if (existingOrganizationResult.error) {
    redirectWithMessage(existingOrganizationResult.error.message);
  }

  let organizationId = existingOrganizationResult.data?.id;

  if (!organizationId) {
    console.log("initializeWorkspaceAction:createOrganization");
    const organizationInsertResult = await admin
      .from("organizations")
      .insert({ name: organizationName })
      .select("id")
      .single();

    if (organizationInsertResult.error) {
      redirectWithMessage(organizationInsertResult.error.message);
    }

    organizationId = requireData(
      organizationInsertResult.data,
      "Organization creation returned no data.",
    ).id;
  }

  const profileInsertResult = await admin
    .from("profiles")
    .insert({
      auth_user_id: user.id,
      organization_id: organizationId,
      full_name: fullName,
      email: user.email,
      role: "system_admin",
    })
    .select("id")
    .single();
  console.log("initializeWorkspaceAction:profileInsert");

  if (profileInsertResult.error) {
    redirectWithMessage(profileInsertResult.error.message);
  }

  const adminProfileId = requireData(
    profileInsertResult.data,
    "Profile creation returned no data.",
  ).id;

  const strengthsResult = await admin
    .from("strengths_library")
    .upsert(strengthsLibrary, { onConflict: "theme_name" });

  if (strengthsResult.error) {
    redirectWithMessage(strengthsResult.error.message);
  }

  const existingProjectTitlesResult = await admin
    .from("development_projects")
    .select("title")
    .is("organization_id", null);

  if (existingProjectTitlesResult.error) {
    redirectWithMessage(existingProjectTitlesResult.error.message);
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
      redirectWithMessage(projectsInsertResult.error.message);
    }
  }

  let roleId: string;
  const existingRoleResult = await admin
    .from("roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("title", demoRole.title)
    .maybeSingle();

  if (existingRoleResult.error) {
    redirectWithMessage(existingRoleResult.error.message);
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
      redirectWithMessage(roleInsertResult.error.message);
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
    redirectWithMessage(existingCompetenciesResult.error.message);
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
      redirectWithMessage(competenciesInsertResult.error.message);
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
    redirectWithMessage(existingQuestionsResult.error.message);
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
      redirectWithMessage(questionsInsertResult.error.message);
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
    redirectWithMessage(existingCandidateResult.error.message);
  }

  if (existingCandidateResult.data) {
    candidateId = existingCandidateResult.data.id;
  } else {
    const candidateInsertResult = await admin
      .from("candidates")
      .insert({
        organization_id: organizationId,
        full_name: "Erin Demo",
        current_title: "Director of Med-Surg Services",
        target_role_id: roleId,
        mentor_profile_id: adminProfileId,
        status: "active",
      })
      .select("id")
      .single();

    if (candidateInsertResult.error) {
      redirectWithMessage(candidateInsertResult.error.message);
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
    redirectWithMessage(existingCandidateStrengthsResult.error.message);
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
      redirectWithMessage(candidateStrengthsInsertResult.error.message);
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
    redirectWithMessage(considerationSeedResult.error.message);
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
    redirectWithMessage(mentorAssignmentSeedResult.error.message);
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
    redirectWithMessage(existingPanelResult.error.message);
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
      redirectWithMessage(panelInsertResult.error.message);
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
    redirectWithMessage(existingScoresResult.error.message);
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
      redirectWithMessage(scoresInsertResult.error.message);
    }
  }

  revalidatePath("/dashboard");
  console.log("initializeWorkspaceAction:complete");
  redirectWithMessage("Workspace initialized with your admin profile and demo hospital data.");
}
