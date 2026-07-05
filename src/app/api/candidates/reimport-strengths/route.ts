import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { getStrengthsUploadDocumentCategory } from "@/lib/candidate-source-documents";
import { syncCandidateRoleStrengthAssessments } from "@/lib/strengths-role-fit";
import { analyzeStrengthsDocuments } from "@/lib/strengths-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const payload = (await request.json()) as { candidateId?: string };
    const candidateId =
      typeof payload.candidateId === "string" && payload.candidateId
        ? payload.candidateId
        : null;

    if (!candidateId) {
      throw new ApiRouteError("Select a candidate first.", 400);
    }

    const [candidateResult, strengthsLibraryResult, sourceDocumentsResult] =
      await Promise.all([
        admin
          .from("candidates")
          .select("id, full_name, target_role_id")
          .eq("organization_id", profile.organization_id)
          .eq("id", candidateId)
          .maybeSingle(),
        admin
          .from("strengths_library")
          .select(
            "theme_name, domain, leadership_advantages, possible_blind_spots, development_uses",
          )
          .order("theme_name", { ascending: true }),
        admin
          .from("candidate_source_documents")
          .select("file_name, extracted_text")
          .eq("organization_id", profile.organization_id)
          .eq("candidate_id", candidateId)
          .eq("document_category", getStrengthsUploadDocumentCategory())
          .order("created_at", { ascending: false }),
      ]);

    for (const result of [
      candidateResult,
      strengthsLibraryResult,
      sourceDocumentsResult,
    ]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
    }

    if (!candidateResult.data) {
      throw new ApiRouteError("Selected candidate could not be found.", 404);
    }

    const analyzableDocuments = (sourceDocumentsResult.data ?? [])
      .filter((document) => (document.extracted_text ?? "").trim().length > 0)
      .map((document) => ({
        fileName: document.file_name,
        text: document.extracted_text ?? "",
      }));

    if (analyzableDocuments.length === 0) {
      throw new ApiRouteError(
        "The archived Gallup files are on record, but none currently contain machine-readable text for strengths import.",
        400,
      );
    }

    const analysis = await analyzeStrengthsDocuments({
      candidateName: candidateResult.data.full_name,
      documents: analyzableDocuments,
      themes: strengthsLibraryResult.data ?? [],
    });

    const deleteResult = await admin
      .from("candidate_strengths")
      .delete()
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId);

    if (deleteResult.error) {
      throw new ApiRouteError(deleteResult.error.message, 500);
    }

    const insertResult = await admin.from("candidate_strengths").insert(
      analysis.rankings.map((item) => ({
        organization_id: profile.organization_id,
        candidate_id: candidateId,
        theme_name: item.theme_name,
        rank: item.rank,
        domain: item.domain,
        notes: item.notes ?? null,
      })),
    );

    if (insertResult.error) {
      throw new ApiRouteError(insertResult.error.message, 500);
    }

    let strengthsFitWarning: string | null = null;

    try {
      const considerationsResult = await admin
        .from("candidate_role_considerations")
        .select("role_id")
        .eq("organization_id", profile.organization_id)
        .eq("candidate_id", candidateId);

      if (considerationsResult.error) {
        throw considerationsResult.error;
      }

      const considerationRoleIds =
        (considerationsResult.data ?? []).map((item) => item.role_id) ?? [];
      const candidateRoleIds = new Set(considerationRoleIds);

      if (candidateResult.data.target_role_id) {
        candidateRoleIds.add(candidateResult.data.target_role_id);
      }

      for (const roleId of candidateRoleIds) {
        const [roleResult, competenciesResult] = await Promise.all([
          admin
            .from("roles")
            .select("id, title, description")
            .eq("organization_id", profile.organization_id)
            .eq("id", roleId)
            .maybeSingle(),
          admin
            .from("role_competencies")
            .select(
              "id, name, definition, target_score, weight, behavioral_indicators, red_flags",
            )
            .eq("organization_id", profile.organization_id)
            .eq("role_id", roleId)
            .order("created_at", { ascending: true }),
        ]);

        if (roleResult.error) {
          throw roleResult.error;
        }

        if (competenciesResult.error) {
          throw competenciesResult.error;
        }

        if (!roleResult.data || (competenciesResult.data ?? []).length === 0) {
          continue;
        }

        await syncCandidateRoleStrengthAssessments({
          admin,
          organizationId: profile.organization_id,
          candidateId,
          roleId,
          candidateName: candidateResult.data.full_name,
          roleTitle: roleResult.data.title,
          roleDescription: roleResult.data.description,
          competencies: (competenciesResult.data ?? []).map((competency) => ({
            ...competency,
            behavioral_indicators: competency.behavioral_indicators as string[],
            red_flags: competency.red_flags as string[],
          })),
          strengths: analysis.rankings,
          strengthsLibrary: (strengthsLibraryResult.data ?? []).map((theme) => ({
            theme_name: theme.theme_name,
            domain: theme.domain,
            leadership_advantages: theme.leadership_advantages,
            possible_blind_spots: theme.possible_blind_spots,
            development_uses: theme.development_uses,
          })),
          force: true,
        });
      }
    } catch (error) {
      console.error("Failed to refresh strengths-based role fit after reimport", {
        candidateId,
        error,
      });
      strengthsFitWarning =
        "Strengths were imported, but the strengths-based readiness score could not be refreshed.";
    }

    return NextResponse.json({
      message: strengthsFitWarning
        ? `Reimported ${analysis.rankings.length} strengths for ${candidateResult.data.full_name}. ${strengthsFitWarning}`
        : `Reimported ${analysis.rankings.length} strengths for ${candidateResult.data.full_name}.`,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to reimport strengths from archived files.",
    );
  }
}
