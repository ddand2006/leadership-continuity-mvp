import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminAppRole } from "@/lib/mentor-access";
import { requireWorkspaceProfile } from "@/lib/workspace";

const schema = z.object({ organizationUserId: z.string().uuid(), roleId: z.string().uuid(), supervisorOrganizationUserId: z.string().uuid().nullable().optional(), department: z.string().trim().max(160).optional() });
export async function POST(request: Request) {
  try { const { profile } = await requireWorkspaceProfile(); if (!isAdminAppRole(profile.role)) return NextResponse.json({ error: "Only administrators can manage current roles." }, { status: 403 }); const input = schema.parse(await request.json()); const admin = createSupabaseAdminClient();
    const [user, role] = await Promise.all([admin.from("organization_users").select("id").eq("organization_id", profile.organization_id).eq("id", input.organizationUserId).maybeSingle(), admin.from("roles").select("id").eq("organization_id", profile.organization_id).eq("id", input.roleId).maybeSingle()]);
    if (user.error || role.error) throw user.error ?? role.error; if (!user.data || !role.data) return NextResponse.json({ error: "Employee or role was not found in this organization." }, { status: 400 });
    await admin.from("employee_role_assignments").update({ status: "ended", effective_to: new Date().toISOString().slice(0, 10) }).eq("organization_id", profile.organization_id).eq("organization_user_id", input.organizationUserId).eq("status", "active");
    const saved = await admin.from("employee_role_assignments").insert({ organization_id: profile.organization_id, organization_user_id: input.organizationUserId, role_id: input.roleId, supervisor_organization_user_id: input.supervisorOrganizationUserId ?? null, department: input.department || null }).select("id").single(); if (saved.error) throw saved.error;
    return NextResponse.json(saved.data, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to assign current role." }, { status: 400 }); }
}
