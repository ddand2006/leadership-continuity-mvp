import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiRouteError, createApiErrorResponse } from "@/lib/api-route";
import { MENTORING_DOCUMENTS_BUCKET, WORD_DOCUMENT_MIME, requireMentoringDocumentAccess } from "@/lib/mentoring-documents";
import { isActiveMentorAssignmentStatus, mentorHasCandidateAccess } from "@/lib/mentor-access";
import { sendResendEmail } from "@/lib/resend";

export const runtime = "nodejs";
const querySchema = z.object({ candidateId: z.string().uuid(), documentId: z.string().uuid().optional() });
const sendSchema = querySchema.extend({ documentId: z.string().uuid(), recipientId: z.string().uuid(), requestId: z.string().uuid() });
type Context = Awaited<ReturnType<typeof requireMentoringDocumentAccess>>;

async function recipients(context: Context, roleId?: string | null) {
  const { admin, profile, assignments, candidate } = context;
  const mentorIds = assignments.filter((a) => isActiveMentorAssignmentStatus(a.status) && (!roleId || a.role_id === roleId)).map((a) => a.mentor_profile_id);
  const result = await admin.from("organization_users")
    .select("id, first_name, last_name, email, candidate_id, profile_id, is_candidate, is_mentor")
    .eq("organization_id", profile.organization_id).in("status", ["active", "invited"]).is("deleted_at", null);
  if (result.error) throw new ApiRouteError("Unable to load recipients.", 500);
  return (result.data ?? []).flatMap((user) => {
    const mentee = user.is_candidate && user.candidate_id === candidate.id;
    const mentor = user.is_mentor && mentorIds.includes(user.profile_id);
    return mentee || mentor ? [{ id: user.id, name: `${user.first_name} ${user.last_name}`, email: user.email, relationship: mentee ? "Mentee" : "Mentor" }] : [];
  });
}

async function loadDocument(context: Context, id: string) {
  const result = await context.admin.from("mentoring_documents").select("*")
    .eq("organization_id", context.profile.organization_id).eq("candidate_id", context.candidate.id).eq("id", id).maybeSingle();
  if (result.error) throw new ApiRouteError("Unable to load the saved document.", 500);
  if (!result.data) throw new ApiRouteError("Document not found.", 404);
  if (!context.unrestricted && !mentorHasCandidateAccess({ profileId: context.profile.id, candidateId: context.candidate.id, roleId: result.data.role_id ?? undefined, mentorAssignments: context.assignments })) {
    throw new ApiRouteError("You do not have access to this document.", 403);
  }
  return result.data;
}

export async function GET(request: Request) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new ApiRouteError("Invalid document request.", 400);
    const { candidateId, documentId } = parsed.data;
    const context = await requireMentoringDocumentAccess(candidateId);
    if (documentId) {
      const document = await loadDocument(context, documentId);
      const file = await context.admin.storage.from(MENTORING_DOCUMENTS_BUCKET).download(document.storage_path);
      if (file.error || !file.data) throw new ApiRouteError("Unable to open the saved document.", 500);
      return new NextResponse(await file.data.arrayBuffer(), { headers: {
        "Content-Type": WORD_DOCUMENT_MIME,
        "Content-Disposition": `attachment; filename="${document.file_name.replace(/["\r\n]/g, "")}"`,
        "Cache-Control": "private, no-store",
      } });
    }
    const result = await context.admin.from("mentoring_documents")
      .select("id, title, file_name, role_id, created_at")
      .eq("organization_id", context.profile.organization_id).eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    if (result.error) throw new ApiRouteError("Saved documents are unavailable. Ask your administrator to enable document storage.", 503);
    const documents = (result.data ?? []).filter((doc) => context.unrestricted || mentorHasCandidateAccess({ profileId: context.profile.id, candidateId, roleId: doc.role_id ?? undefined, mentorAssignments: context.assignments }));
    const roles = [...new Set(documents.map((doc) => doc.role_id))];
    const byRole = new Map(await Promise.all(roles.map(async (roleId) => [roleId, await recipients(context, roleId)] as const)));
    return NextResponse.json({ documents: documents.map((doc) => ({ ...doc, recipients: byRole.get(doc.role_id) ?? [] })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to load saved documents.");
  }
}

export async function POST(request: Request) {
  try {
    const parsed = sendSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiRouteError("Choose a document and recipient.", 400);
    const payload = parsed.data;
    const context = await requireMentoringDocumentAccess(payload.candidateId);
    const document = await loadDocument(context, payload.documentId);
    const recipient = (await recipients(context, document.role_id)).find((item) => item.id === payload.recipientId);
    if (!recipient) throw new ApiRouteError("This recipient is no longer assigned to this mentoring track.", 400);
    const file = await context.admin.storage.from(MENTORING_DOCUMENTS_BUCKET).download(document.storage_path);
    if (file.error || !file.data) throw new ApiRouteError("Unable to attach the saved document. No email was sent.", 500);
    await sendResendEmail({
      to: recipient.email,
      subject: `Mentoring document: ${document.title.replace(/[\r\n]/g, " ")}`,
      text: `Hi ${recipient.name},\n\n${context.profile.full_name} shared a mentoring document for ${context.candidate.full_name}. The saved Word document is attached.`,
      html: "<p>A mentoring document has been shared with you. The saved Word document is attached.</p>",
      attachments: [{ filename: document.file_name, content: Buffer.from(await file.data.arrayBuffer()).toString("base64") }],
      idempotencyKey: `mentoring-document-${document.id}-${recipient.id}-${payload.requestId}`,
    });
    return NextResponse.json({ message: `Email sent to ${recipient.name} (${recipient.email}).` });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to email this document.");
  }
}
