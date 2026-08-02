import { NextResponse } from "next/server";
import { ApiRouteError, createApiErrorResponse, requireApiWorkspaceProfile } from "@/lib/api-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({ product: "leadership_help" });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) throw new ApiRouteError("Upload a non-empty CSV, XLS, or XLSX file.", 400);
    if (file.size > 50 * 1024 * 1024) throw new ApiRouteError("Uploaded file must be 50 MB or smaller.", 400);
    const extension = file.name.toLowerCase().split(".").at(-1);
    if (!["csv", "xls", "xlsx"].includes(extension ?? "")) throw new ApiRouteError("Use a CSV, XLS, or XLSX competency file.", 400);
    const personal = await admin.from("personal_development_profiles").select("id").eq("organization_id", profile.organization_id).eq("profile_id", profile.id).maybeSingle();
    if (personal.error) throw new ApiRouteError(personal.error.message, 500);
    const role = personal.data ? await admin.from("personal_role_profiles").select("id").eq("organization_id", profile.organization_id).eq("personal_development_profile_id", personal.data.id).eq("role_mode", "personal_role").maybeSingle() : null;
    if (!role?.data) throw new ApiRouteError("Create a personal role profile before importing its competencies.", 400);
    const personalRoleProfile = role.data;
    const parser = await import("@/lib/role-candidate-characteristics");
    const imported = await parser.parseRoleCharacteristicsWorkbook(Buffer.from(await file.arrayBuffer()), file.name);
    const names = Array.from(new Set(imported.map((item) => item.characteristic.trim()).filter(Boolean))).slice(0, 30);
    if (names.length === 0) throw new ApiRouteError("No competency names were found in that file.", 400);
    const existing = await admin.from("personal_role_competencies").select("name").eq("personal_role_profile_id", personalRoleProfile.id);
    if (existing.error) throw new ApiRouteError(existing.error.message, 500);
    const existingNames = new Set((existing.data ?? []).map((item) => item.name.toLowerCase()));
    const values = names.filter((name) => !existingNames.has(name.toLowerCase()));
    if (values.length) {
      const insert = await admin.from("personal_role_competencies").insert(values.map((name, index) => ({ organization_id: profile.organization_id, personal_role_profile_id: personalRoleProfile.id, name, sort_order: (existing.data?.length ?? 0) + index })));
      if (insert.error) throw new ApiRouteError(insert.error.message, 500);
    }
    return NextResponse.json({ message: values.length ? `Imported ${values.length} competencies. Review and save the role profile to refine them.` : "All competencies in this file are already present.", count: values.length });
  } catch (error) { return createApiErrorResponse(error, "Unable to import personal role competencies."); }
}
