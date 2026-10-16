import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiRouteError, createApiErrorResponse } from "@/lib/api-route";
import { requirePartnerContext, resolvePartnerInvitee } from "@/lib/partner-account";

const input = z.object({ name: z.string().trim().min(2).max(200), email: z.string().trim().email(), role: z.enum(["admin", "finance", "member"]), status: z.enum(["active", "inactive"]).default("active") });
export async function POST(request: Request) {
  try {
    const { admin, application, role } = await requirePartnerContext(true);
    if (role !== "owner") throw new ApiRouteError("Only the partner owner can manage team access.", 403);
    const validation = input.safeParse(await request.json());
    if (!validation.success) throw new ApiRouteError("Enter valid team member details.", 400);
    const p = validation.data;
    let identity;
    if(p.status==="inactive") {
      const found=await admin.rpc("partner_user_for_email",{address:p.email.toLowerCase()});
      if(found.error)throw new Error(found.error.message);
      if(!found.data)throw new ApiRouteError("No existing team account uses that email.",404);
      identity={userId:found.data as string,invitationSent:false};
    } else identity=await resolvePartnerInvitee(p.email, "/partner-account/dashboard", p.name);
    const current = await admin.from("affiliate_memberships").select("role").eq("affiliate_id", application.affiliate_id).eq("user_id", identity.userId).maybeSingle();
    if (current.error) throw new Error(current.error.message);
    if (current.data?.role === "owner") throw new ApiRouteError("The owner’s access cannot be changed here.", 403);
    const result = await admin.from("affiliate_memberships").upsert({ affiliate_id: application.affiliate_id, user_id: identity.userId, role: p.role, status: p.status })
      .select("user_id,role,status").single();
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ member: result.data, message: identity.invitationSent ? "Team invitation sent." : "Team access updated for the existing account." });
  } catch (error) { return createApiErrorResponse(error, "Unable to update team access."); }
}
