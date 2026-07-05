import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import {
  buildCandidateSourceDocumentStoragePath,
  getCandidateSourceDocumentsBucket,
  getStrengthsUploadDocumentCategory,
} from "@/lib/candidate-source-documents";
import {
  assertAcceptedFileType,
  extractTextFromUploadedFile,
  getFileExtension,
} from "@/lib/file-parsers";
import { syncCandidateRoleStrengthAssessments } from "@/lib/strengths-role-fit";
import { analyzeStrengthsDocuments } from "@/lib/strengths-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const formData = await request.formData();
    const filesFromForm = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    const fallbackFile = formData.get("file");
    const files =
      filesFromForm.length > 0
        ? filesFromForm
        : fallbackFile instanceof File
          ? [fallbackFile]
          : [];
    const candidateIdValue = formData.get("candidateId");
    const candidateId =
      typeof candidateIdValue === "string" && candidateIdValue
        ? candidateIdValue
        : null;

    if (!candidateId) {
      throw new ApiRouteError("Select a candidate first.", 400);
    }

    if (files.length === 0) {
      throw new ApiRouteError(
        "Upload one or more StrengthsFinder results files first.",
        400,
      );
    }

    files.forEach((file) => {
      assertAcceptedFileType(file, ["pdf", "docx", "csv", "txt"]);
    });

    const candidateResult = await admin
      .from("candidates")
      .select("id, full_name, target_role_id")
      .eq("organization_id", profile.organization_id)
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateResult.error) {
      throw new ApiRouteError(candidateResult.error.message, 500);
    }

    if (!candidateResult.data) {
      throw new ApiRouteError("Selected candidate could not be found.", 404);
    }

    const strengthsLibraryResult = await admin
      .from("strengths_library")
      .select(
        "theme_name, domain, leadership_advantages, possible_blind_spots, development_uses",
      )
      .order("theme_name", { ascending: true });

    if (strengthsLibraryResult.error) {
      throw new ApiRouteError(strengthsLibraryResult.error.message, 500);
    }

    const bucket = getCandidateSourceDocumentsBucket();
    const documentCategory = getStrengthsUploadDocumentCategory();
    const existingDocumentsResult = await admin
      .from("candidate_source_documents")
      .select(
        "id, file_name, file_extension, file_size_bytes, mime_type, extracted_text, storage_path",
      )
      .eq("organization_id", profile.organization_id)
      .eq("candidate_id", candidateId)
      .eq("document_category", documentCategory);

    if (existingDocumentsResult.error) {
      throw new ApiRouteError(existingDocumentsResult.error.message, 500);
    }

    const uploadedDocuments = await Promise.all(
      files.map(async (file) => {
        const fileExtension = file.name.toLowerCase().split(".").at(-1) ?? "";

        try {
          return {
            file,
            fileName: file.name,
            fileExtension,
            fileSizeBytes: file.size,
            mimeType: file.type || null,
            text: await extractTextFromUploadedFile(file, [
              "pdf",
              "docx",
              "csv",
              "txt",
            ]),
            extractionWarning: null as string | null,
          };
        } catch (error) {
          const isPdfExtractionFailure =
            getFileExtension(file.name) === "pdf" &&
            error instanceof ApiRouteError &&
            (error.message.includes("Unable to read text from this PDF") ||
              error.message.includes("Could not read any text"));

          if (!isPdfExtractionFailure) {
            throw error;
          }

          return {
            file,
            fileName: file.name,
            fileExtension,
            fileSizeBytes: file.size,
            mimeType: file.type || null,
            text: "",
            extractionWarning: error.message,
          };
        }
      }),
    );
    const incomingFileNames = new Set(
      uploadedDocuments.map((document) => document.fileName.toLowerCase()),
    );
    const existingDocumentsToKeep = (existingDocumentsResult.data ?? []).filter(
      (document) => !incomingFileNames.has(document.file_name.toLowerCase()),
    );
    const analyzableDocuments = [
      ...existingDocumentsToKeep
        .filter((document) => (document.extracted_text ?? "").trim().length > 0)
        .map((document) => ({
          fileName: document.file_name,
          text: document.extracted_text ?? "",
        })),
      ...uploadedDocuments
        .filter((document) => document.text.trim().length > 0)
        .map((document) => ({
          fileName: document.fileName,
          text: document.text,
        })),
    ];
    const unreadablePdfCount = uploadedDocuments.filter(
      (document) => document.extractionWarning !== null,
    ).length;
    let analysis:
      | Awaited<ReturnType<typeof analyzeStrengthsDocuments>>
      | null = null;
    let strengthsImportWarning: string | null = null;

    if (analyzableDocuments.length > 0) {
      try {
        analysis = await analyzeStrengthsDocuments({
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
      } catch (analysisError) {
        console.error("Failed to analyze strengths documents", {
          candidateId,
          error: analysisError,
        });
        strengthsImportWarning =
          "The files were archived, but strengths could not be imported from the currently readable text.";
      }
    } else {
      strengthsImportWarning =
        "The files were archived, but none of the uploaded PDFs contained machine-readable text for strengths import.";
    }

    let strengthsFitWarning: string | null = null;

    if (analysis) {
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
      } catch (strengthsFitError) {
        console.error("Failed to calculate strengths-based role fit", {
          candidateId,
          error: strengthsFitError,
        });
        strengthsFitWarning =
          "Strengths were imported, but the strengths-based readiness score could not be refreshed.";
      }
    } else if (unreadablePdfCount > 0) {
      strengthsFitWarning = null;
    }

    let archiveWarning: string | null = null;

    try {
      const uploadedStorageDocuments: {
        extractedText: string;
        fileExtension: string;
        fileName: string;
        fileSizeBytes: number;
        mimeType: string | null;
        storagePath: string;
      }[] = [];

      try {
        for (const document of uploadedDocuments) {
          const storagePath = buildCandidateSourceDocumentStoragePath({
            organizationId: profile.organization_id,
            candidateId,
            fileName: document.fileName,
          });
          const uploadResult = await admin.storage
            .from(bucket)
            .upload(storagePath, Buffer.from(await document.file.arrayBuffer()), {
              contentType: document.mimeType ?? undefined,
              upsert: false,
            });

          if (uploadResult.error) {
            throw uploadResult.error;
          }

          uploadedStorageDocuments.push({
            extractedText: document.text,
            fileExtension: document.fileExtension,
            fileName: document.fileName,
            fileSizeBytes: document.fileSizeBytes,
            mimeType: document.mimeType,
            storagePath,
          });
        }
      } catch (storageError) {
        if (uploadedStorageDocuments.length > 0) {
          await admin.storage
            .from(bucket)
            .remove(uploadedStorageDocuments.map((document) => document.storagePath));
        }

        throw storageError;
      }

      const replacedStoragePaths =
        (existingDocumentsResult.data ?? [])
          .filter((document) => incomingFileNames.has(document.file_name.toLowerCase()))
          ?.map((document) => document.storage_path)
          .filter(Boolean) ?? [];

      const deleteReplacedDocumentsResult =
        replacedStoragePaths.length > 0
          ? await admin
              .from("candidate_source_documents")
              .delete()
              .eq("organization_id", profile.organization_id)
              .eq("candidate_id", candidateId)
              .eq("document_category", documentCategory)
              .in(
                "file_name",
                uploadedDocuments.map((document) => document.fileName),
              )
          : { error: null };

      if (deleteReplacedDocumentsResult.error) {
        throw deleteReplacedDocumentsResult.error;
      }

      const insertDocumentsResult = await admin
        .from("candidate_source_documents")
        .insert(
          uploadedStorageDocuments.map((document) => ({
            organization_id: profile.organization_id,
            candidate_id: candidateId,
            created_by_profile_id: profile.id,
            document_category: documentCategory,
            file_name: document.fileName,
            file_extension: document.fileExtension,
            mime_type: document.mimeType,
            file_size_bytes: document.fileSizeBytes,
            storage_bucket: bucket,
            storage_path: document.storagePath,
            extracted_text: document.extractedText,
          })),
        );

      if (insertDocumentsResult.error) {
        await admin.storage
          .from(bucket)
          .remove(uploadedStorageDocuments.map((document) => document.storagePath));
        throw insertDocumentsResult.error;
      }

      if (replacedStoragePaths.length > 0) {
        const removeOldFilesResult = await admin.storage
          .from(bucket)
          .remove(replacedStoragePaths);

        if (removeOldFilesResult.error) {
          console.error("Failed to remove replaced candidate source documents", {
            candidateId,
            storagePaths: replacedStoragePaths,
            error: removeOldFilesResult.error,
          });
        }
      }
    } catch (documentArchiveError) {
      console.error("Failed to archive candidate source documents", {
        candidateId,
        error: documentArchiveError,
      });
      archiveWarning =
        "Strengths were imported, but the uploaded source documents could not be archived.";
    }

    const warningMessage = [strengthsFitWarning, archiveWarning]
      .concat(
        unreadablePdfCount > 0
          ? [
              `${unreadablePdfCount} PDF${unreadablePdfCount === 1 ? "" : "s"} ${
                unreadablePdfCount === 1 ? "was" : "were"
              } archived without readable text extraction.`,
            ]
          : [],
      )
      .concat(strengthsImportWarning ? [strengthsImportWarning] : [])
      .filter(Boolean)
      .join(" ");

    return NextResponse.json({
      message: warningMessage
        ? `Added ${files.length} file${files.length === 1 ? "" : "s"}, analyzed ${analyzableDocuments.length} readable file${analyzableDocuments.length === 1 ? "" : "s"} on record, and imported ${analysis?.rankings.length ?? 0} strengths for ${candidateResult.data.full_name}. ${warningMessage}`
        : `Added ${files.length} file${files.length === 1 ? "" : "s"}, analyzed ${analyzableDocuments.length} readable file${analyzableDocuments.length === 1 ? "" : "s"} on record, and imported ${analysis?.rankings.length ?? 0} strengths for ${candidateResult.data.full_name}.`,
      count: analysis?.rankings.length ?? 0,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unexpected strengths upload failure.");
  }
}
