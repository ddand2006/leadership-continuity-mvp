import { randomUUID } from "node:crypto";
import { ApiRouteError, requireApiWorkspaceProfile } from "@/lib/api-route";
import { isAdminAppRole, isCandidateSelfAccess, mentorHasCandidateAccess } from "@/lib/mentor-access";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const MENTORING_DOCUMENTS_BUCKET = "mentoring-documents";
export const WORD_DOCUMENT_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function saveMentoringDocument(input: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  organizationId: string;
  candidateId: string;
  roleId?: string;
  profileId: string;
  title: string;
  fileName: string;
  buffer: Buffer;
}) {
  const id = randomUUID();
  const storagePath = `${input.organizationId}/${input.candidateId}/${id}.docx`;
  const bucket = input.admin.storage.from(MENTORING_DOCUMENTS_BUCKET);
  const upload = await bucket.upload(storagePath, input.buffer, { contentType: WORD_DOCUMENT_MIME });
  if (upload.error) throw new ApiRouteError("Unable to save the document. Please try again or contact your administrator.", 500);
  const result = await input.admin.from("mentoring_documents").insert({
    id, organization_id: input.organizationId, candidate_id: input.candidateId,
    role_id: input.roleId ?? null, created_by_profile_id: input.profileId,
    title: input.title, file_name: input.fileName, storage_path: storagePath,
  });
  if (result.error) {
    await bucket.remove([storagePath]);
    throw new ApiRouteError("Unable to save the document record. Please try again or contact your administrator.", 500);
  }
  return id;
}

export async function requireMentoringDocumentAccess(candidateId: string, roleId?: string) {
  const context = await requireApiWorkspaceProfile();
  const { admin, profile, account } = context;
  const [candidate, assignments] = await Promise.all([
    admin.from("candidates").select("id, full_name").eq("organization_id", profile.organization_id).eq("id", candidateId).is("deleted_at", null).maybeSingle(),
    admin.from("mentor_role_assignments").select("candidate_id, role_id, mentor_profile_id, status").eq("organization_id", profile.organization_id).eq("candidate_id", candidateId),
  ]);
  if (candidate.error || assignments.error) throw new ApiRouteError("Unable to load document access.", 500);
  if (!candidate.data) throw new ApiRouteError("Candidate not found.", 404);
  const unrestricted = isAdminAppRole(profile.role) || isCandidateSelfAccess(account, candidateId);
  if (!unrestricted && !mentorHasCandidateAccess({ profileId: profile.id, candidateId, roleId, mentorAssignments: assignments.data ?? [] })) {
    throw new ApiRouteError("You do not have access to these documents.", 403);
  }
  return { ...context, candidate: candidate.data, assignments: assignments.data ?? [], unrestricted };
}
