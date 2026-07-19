import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import { assertAcceptedFileType, extractTextFromUploadedFile } from "@/lib/file-parsers";
import { extractRoleCompositeFromText } from "@/lib/role-composite";
import { invalidateRoleInterviewScorecard } from "@/lib/role-interview-scorecard-store";
import { canonicalizeRoleTitle } from "@/lib/role-title";

type ExistingRoleRecord = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
};

function normalizeRoleTitle(value: string) {
  return canonicalizeRoleTitle(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bchief executive officer\b/g, "ceo")
    .replace(/\bchief financial officer\b/g, "cfo")
    .replace(/\bchief nursing officer\b/g, "cno")
    .replace(/\bvice president\b/g, "vp")
    .replace(/\bhuman resources\b/g, "hr")
    .replace(/\bmedical\b/g, "med")
    .replace(/\bpatient care services\b/g, "pcs")
    .replace(/\bservice delivery\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bof\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeRoleTitle(value: string) {
  return normalizeRoleTitle(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function getRoleTitleMatchScore(sourceTitle: string, targetTitle: string) {
  const normalizedSource = normalizeRoleTitle(sourceTitle);
  const normalizedTarget = normalizeRoleTitle(targetTitle);

  if (!normalizedSource || !normalizedTarget) {
    return 0;
  }

  if (normalizedSource === normalizedTarget) {
    return 100;
  }

  const sourceTokens = tokenizeRoleTitle(sourceTitle);
  const targetTokens = tokenizeRoleTitle(targetTitle);
  const targetTokenSet = new Set(targetTokens);
  const sourceTokenSet = new Set(sourceTokens);
  const overlapCount = sourceTokens.filter((token) => targetTokenSet.has(token)).length;

  if (overlapCount === 0) {
    return 0;
  }

  const sourceCovered = overlapCount === sourceTokenSet.size;
  const targetCovered = overlapCount === targetTokenSet.size;

  if (sourceCovered || targetCovered) {
    return 90 - Math.abs(sourceTokenSet.size - targetTokenSet.size);
  }

  const overlapRatio =
    overlapCount / Math.max(sourceTokenSet.size, targetTokenSet.size);

  if (overlapRatio >= 0.8 && overlapCount >= 2) {
    return 70 - Math.abs(sourceTokenSet.size - targetTokenSet.size);
  }

  return 0;
}

function resolveExistingRoleMatch(
  sourceTitle: string,
  existingRoles: ExistingRoleRecord[],
) {
  const rankedMatches = existingRoles
    .map((role) => ({
      role,
      score: getRoleTitleMatchScore(sourceTitle, role.title),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (rankedMatches.length === 0) {
    return null;
  }

  if (
    rankedMatches.length > 1 &&
    rankedMatches[0].score === rankedMatches[1].score
  ) {
    return null;
  }

  return rankedMatches[0].role;
}

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const formData = await request.formData();
    const file = formData.get("file");
    const roleIdValue = formData.get("roleId");
    const statusValue = formData.get("status");
    const roleId = typeof roleIdValue === "string" && roleIdValue ? roleIdValue : null;
    const status =
      statusValue === "active" || statusValue === "draft" ? statusValue : "active";

    if (!(file instanceof File)) {
      throw new ApiRouteError("Upload a composite or interview scorecard file first.", 400);
    }

    assertAcceptedFileType(file, ["pdf", "docx", "txt"]);

    const compositeText = await extractTextFromUploadedFile(file, ["pdf", "docx", "txt"]);

    if (!compositeText) {
      throw new ApiRouteError(
        "No readable text was found in the uploaded role document.",
        400,
      );
    }

    const extractedComposite = await extractRoleCompositeFromText({
      fileName: file.name,
      text: compositeText,
    });
    const normalizedExtractedRoleTitle = canonicalizeRoleTitle(
      extractedComposite.title,
    );
    const isScorecardImport =
      extractedComposite.source_document_type === "interview_scorecard";

    let currentRoleId = roleId;
    let resolvedRoleTitle = normalizedExtractedRoleTitle;
    let existingRoleRecord: ExistingRoleRecord | null = null;

    async function replaceExistingRole(existingRole: ExistingRoleRecord) {
      const nextRoleTitle = isScorecardImport
        ? canonicalizeRoleTitle(existingRole.title)
        : normalizedExtractedRoleTitle;
      resolvedRoleTitle = nextRoleTitle;

      const conflictingRoleResult = await admin
        .from("roles")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("title", nextRoleTitle)
        .neq("id", existingRole.id)
        .maybeSingle();

      if (conflictingRoleResult.error) {
        throw new ApiRouteError(conflictingRoleResult.error.message, 500);
      }

      if (conflictingRoleResult.data) {
        throw new ApiRouteError(
          "Another role already uses the target title. Choose a different role or edit the title manually first.",
          409,
        );
      }

      const updateResult = await admin
        .from("roles")
        .update({
          title: nextRoleTitle,
          department:
            extractedComposite.department ??
            existingRole.department ??
            null,
          description:
            isScorecardImport && existingRole.description?.trim()
              ? existingRole.description
              : extractedComposite.description,
          status,
        })
        .eq("organization_id", profile.organization_id)
        .eq("id", existingRole.id);

      if (updateResult.error) {
        throw new ApiRouteError(updateResult.error.message, 500);
      }

      const deleteCompetenciesResult = await admin
        .from("role_competencies")
        .delete()
        .eq("organization_id", profile.organization_id)
        .eq("role_id", existingRole.id);

      if (deleteCompetenciesResult.error) {
        throw new ApiRouteError(deleteCompetenciesResult.error.message, 500);
      }

      const existingCompositeDocumentResult = await admin
        .from("role_composite_documents")
        .select("storage_bucket, storage_path")
        .eq("organization_id", profile.organization_id)
        .eq("role_id", existingRole.id)
        .maybeSingle();

      if (existingCompositeDocumentResult.error) {
        throw new ApiRouteError(existingCompositeDocumentResult.error.message, 500);
      }

      const deleteCompositeDocumentResult = await admin
        .from("role_composite_documents")
        .delete()
        .eq("organization_id", profile.organization_id)
        .eq("role_id", existingRole.id);

      if (deleteCompositeDocumentResult.error) {
        throw new ApiRouteError(deleteCompositeDocumentResult.error.message, 500);
      }

      if (
        existingCompositeDocumentResult.data?.storage_bucket &&
        existingCompositeDocumentResult.data.storage_path
      ) {
        const removeStoredDocumentResult = await admin.storage
          .from(existingCompositeDocumentResult.data.storage_bucket)
          .remove([existingCompositeDocumentResult.data.storage_path]);

        if (removeStoredDocumentResult.error) {
          console.error("Unable to remove superseded role composite document", {
            roleId: existingRole.id,
            storagePath: existingCompositeDocumentResult.data.storage_path,
            error: removeStoredDocumentResult.error,
          });
        }
      }
      currentRoleId = existingRole.id;
    }

    if (currentRoleId) {
      const existingRoleResult = await admin
        .from("roles")
        .select("id, title, department, description")
        .eq("organization_id", profile.organization_id)
        .eq("id", currentRoleId)
        .maybeSingle();

      if (existingRoleResult.error) {
        throw new ApiRouteError(existingRoleResult.error.message, 500);
      }

      if (!existingRoleResult.data) {
        throw new ApiRouteError("Selected role could not be found.", 404);
      }

      existingRoleRecord = existingRoleResult.data;
      await replaceExistingRole(existingRoleRecord);
    } else {
      const existingRolesResult = await admin
        .from("roles")
        .select("id, title, department, description")
        .eq("organization_id", profile.organization_id);

      if (existingRolesResult.error) {
        throw new ApiRouteError(existingRolesResult.error.message, 500);
      }

      existingRoleRecord = resolveExistingRoleMatch(
        extractedComposite.title,
        existingRolesResult.data ?? [],
      );

      if (existingRoleRecord) {
        await replaceExistingRole(existingRoleRecord);
      } else {
        const insertRoleResult = await admin
          .from("roles")
          .insert({
            organization_id: profile.organization_id,
            title: normalizedExtractedRoleTitle,
            department: extractedComposite.department,
            description: extractedComposite.description,
            status,
          })
          .select("id")
          .single();

        if (insertRoleResult.error) {
          throw new ApiRouteError(insertRoleResult.error.message, 500);
        }

        currentRoleId = insertRoleResult.data.id;
        resolvedRoleTitle = normalizedExtractedRoleTitle;
      }
    }

    const insertCompetenciesResult = await admin.from("role_competencies").insert(
      extractedComposite.competencies.map((competency, index) => ({
        organization_id: profile.organization_id,
        role_id: currentRoleId,
        created_at: new Date(Date.now() + index * 1000).toISOString(),
        ...competency,
      })),
    );

    if (insertCompetenciesResult.error) {
      throw new ApiRouteError(insertCompetenciesResult.error.message, 500);
    }

    if (!currentRoleId) {
      throw new ApiRouteError("Unable to resolve the role for this import.", 500);
    }

    await invalidateRoleInterviewScorecard({
      admin,
      organizationId: profile.organization_id,
      roleId: currentRoleId,
    });

    return NextResponse.json({
      message: isScorecardImport
        ? `Interview scorecard imported into "${resolvedRoleTitle}" and the structured competency model now matches the scorecard sections.`
        : `Composite imported into "${resolvedRoleTitle}".`,
      roleId: currentRoleId,
      competenciesCreated: extractedComposite.competencies.length,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unexpected role composite upload failure.");
  }
}
