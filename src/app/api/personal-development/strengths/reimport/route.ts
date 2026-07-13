import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { isMissingPersonalDevelopmentTablesError } from "@/lib/personal-development";
import { getPersonalStrengthsUploadDocumentCategory } from "@/lib/personal-source-documents";
import { analyzeStrengthsDocuments } from "@/lib/strengths-upload";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      product: "leadership_help",
    });

    const personalProfileResult = await admin
      .from("personal_development_profiles")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (personalProfileResult.error) {
      if (isMissingPersonalDevelopmentTablesError(personalProfileResult.error)) {
        throw new ApiRouteError(
          "Apply the Personal Development foundation migration before reimporting strengths.",
          400,
        );
      }

      throw new ApiRouteError(personalProfileResult.error.message, 500);
    }

    if (!personalProfileResult.data) {
      throw new ApiRouteError(
        "Save your role profile before reimporting Personal Development strengths.",
        400,
      );
    }

    const personalDevelopmentProfileId = personalProfileResult.data.id;

    const [strengthsLibraryResult, sourceDocumentsResult] = await Promise.all([
      admin
        .from("strengths_library")
        .select("theme_name, domain")
        .order("theme_name", { ascending: true }),
      admin
        .from("personal_source_documents")
        .select("file_name, extracted_text")
        .eq("organization_id", profile.organization_id)
        .eq("personal_development_profile_id", personalDevelopmentProfileId)
        .eq("document_category", getPersonalStrengthsUploadDocumentCategory())
        .order("created_at", { ascending: false }),
    ]);

    for (const result of [strengthsLibraryResult, sourceDocumentsResult]) {
      if (result.error) {
        throw new ApiRouteError(result.error.message, 500);
      }
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
      candidateName: profile.full_name,
      documents: analyzableDocuments,
      themes: strengthsLibraryResult.data ?? [],
    });

    const deleteResult = await admin
      .from("personal_strength_profiles")
      .delete()
      .eq("organization_id", profile.organization_id)
      .eq("personal_development_profile_id", personalDevelopmentProfileId);

    if (deleteResult.error) {
      throw new ApiRouteError(deleteResult.error.message, 500);
    }

    const insertResult = await admin.from("personal_strength_profiles").insert(
      analysis.rankings.map((item) => ({
        organization_id: profile.organization_id,
        personal_development_profile_id: personalDevelopmentProfileId,
        theme_name: item.theme_name,
        rank: item.rank,
        domain: item.domain,
        notes: item.notes ?? null,
      })),
    );

    if (insertResult.error) {
      throw new ApiRouteError(insertResult.error.message, 500);
    }

    return NextResponse.json({
      message: `Reimported ${analysis.rankings.length} strengths into your Personal Development workspace.`,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unable to reimport strengths from archived Personal Development files.",
    );
  }
}
