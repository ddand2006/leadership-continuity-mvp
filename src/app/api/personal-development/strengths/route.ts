import { NextResponse } from "next/server";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";
import {
  buildPersonalSourceDocumentStoragePath,
  getPersonalSourceDocumentsBucket,
  getPersonalStrengthsUploadDocumentCategory,
} from "@/lib/personal-source-documents";
import {
  assertAcceptedFileType,
  extractTextFromUploadedFile,
  getFileExtension,
} from "@/lib/file-parsers";
import { isMissingPersonalDevelopmentTablesError } from "@/lib/personal-development";
import { analyzeStrengthsDocuments } from "@/lib/strengths-upload";

export const runtime = "nodejs";

async function ensurePersonalSourceDocumentsBucket(
  admin: Awaited<ReturnType<typeof requireApiWorkspaceProfile>>["admin"],
  bucket: string,
) {
  const createBucketResult = await admin.storage.createBucket(bucket, {
    public: false,
  });

  if (
    createBucketResult.error &&
    !createBucketResult.error.message.toLowerCase().includes("already exists")
  ) {
    throw createBucketResult.error;
  }
}

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      product: "leadership_help",
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

    if (files.length === 0) {
      throw new ApiRouteError(
        "Upload one or more StrengthsFinder results files first.",
        400,
      );
    }

    files.forEach((file) => {
      assertAcceptedFileType(file, ["pdf", "docx", "csv", "txt"]);
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
          "Apply the Personal Development foundation migration before uploading strengths.",
          400,
        );
      }

      throw new ApiRouteError(personalProfileResult.error.message, 500);
    }

    if (!personalProfileResult.data) {
      throw new ApiRouteError(
        "Save your role profile before uploading Personal Development strengths.",
        400,
      );
    }

    const personalDevelopmentProfileId = personalProfileResult.data.id;

    const strengthsLibraryResult = await admin
      .from("strengths_library")
      .select("theme_name, domain")
      .order("theme_name", { ascending: true });

    if (strengthsLibraryResult.error) {
      throw new ApiRouteError(strengthsLibraryResult.error.message, 500);
    }

    const bucket = getPersonalSourceDocumentsBucket();
    await ensurePersonalSourceDocumentsBucket(admin, bucket);
    const documentCategory = getPersonalStrengthsUploadDocumentCategory();
    const existingDocumentsResult = await admin
      .from("personal_source_documents")
      .select(
        "id, file_name, file_extension, file_size_bytes, mime_type, extracted_text, storage_path",
      )
      .eq("organization_id", profile.organization_id)
      .eq("personal_development_profile_id", personalDevelopmentProfileId)
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
    let strengthsImportWarning: string | null = null;
    let importedStrengthCount = 0;

    if (analyzableDocuments.length > 0) {
      try {
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

        importedStrengthCount = analysis.rankings.length;
      } catch (analysisError) {
        console.error("Failed to analyze personal strengths documents", {
          profileId: profile.id,
          error: analysisError,
        });
        strengthsImportWarning =
          "Strengths could not be imported from the currently readable text.";
      }
    } else {
      strengthsImportWarning =
        "None of the uploaded PDFs contained machine-readable text for strengths import.";
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
          const storagePath = buildPersonalSourceDocumentStoragePath({
            organizationId: profile.organization_id,
            personalDevelopmentProfileId,
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
          .map((document) => document.storage_path)
          .filter(Boolean) ?? [];

      const deleteReplacedDocumentsResult =
        replacedStoragePaths.length > 0
          ? await admin
              .from("personal_source_documents")
              .delete()
              .eq("organization_id", profile.organization_id)
              .eq("personal_development_profile_id", personalDevelopmentProfileId)
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
        .from("personal_source_documents")
        .insert(
          uploadedStorageDocuments.map((document) => ({
            organization_id: profile.organization_id,
            personal_development_profile_id: personalDevelopmentProfileId,
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
          console.error("Failed to remove replaced personal source documents", {
            profileId: profile.id,
            storagePaths: replacedStoragePaths,
            error: removeOldFilesResult.error,
          });
        }
      }
    } catch (documentArchiveError) {
      console.error("Failed to archive personal source documents", {
        profileId: profile.id,
        error: documentArchiveError,
      });
      archiveWarning =
        "Strengths were imported, but the uploaded source documents could not be archived.";
    }

    const warningParts: string[] = [];

    if (unreadablePdfCount > 0) {
      warningParts.push(
        `${unreadablePdfCount} PDF${unreadablePdfCount === 1 ? "" : "s"} ${
          unreadablePdfCount === 1 ? "was" : "were"
        } accepted, but no readable text could be extracted.`,
      );
    }

    if (strengthsImportWarning) {
      warningParts.push(strengthsImportWarning);
    }

    if (archiveWarning) {
      warningParts.push(archiveWarning);
    }

    const warningMessage = warningParts.join(" ");

    return NextResponse.json({
      message: warningMessage
        ? `Added ${files.length} file${files.length === 1 ? "" : "s"}, analyzed ${analyzableDocuments.length} readable file${analyzableDocuments.length === 1 ? "" : "s"} on record, and imported ${importedStrengthCount} strengths into your Personal Development workspace. ${warningMessage}`
        : `Added ${files.length} file${files.length === 1 ? "" : "s"}, analyzed ${analyzableDocuments.length} readable file${analyzableDocuments.length === 1 ? "" : "s"} on record, and imported ${importedStrengthCount} strengths into your Personal Development workspace.`,
      count: importedStrengthCount,
    });
  } catch (error) {
    return createApiErrorResponse(
      error,
      "Unexpected Personal Development strengths upload failure.",
    );
  }
}
