import { NextResponse } from "next/server";
import { requireApiWorkspaceProfile, ApiRouteError, createApiErrorResponse } from "@/lib/api-route";
import { affiliateInput } from "@/lib/affiliates";

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({ requirePaid: false });
    if (profile.role !== "system_admin") throw new ApiRouteError("Only platform administrators can manage affiliates.", 403);
    const parsed = affiliateInput.safeParse(await request.json());
    if (!parsed.success) throw new ApiRouteError(parsed.error.issues.map(issue => issue.message).join(". "), 400);
    const p = parsed.data;
    const values = { name: p.name, slug: p.slug, draft_branding: p.branding,
      initial_bps: Math.round(p.initialPercent * 100), renewal_bps: Math.round(p.renewalPercent * 100),
      renewal_years: p.renewalYears,
      ...(p.action === "publish" ? { published_branding: p.branding } : {}),
      ...(p.action === "unpublish" ? { published_branding: null } : {}),
    };
    const result = await (p.id ? admin.from("affiliates").update(values).eq("id", p.id) : admin.from("affiliates").insert(values)).select("id").single();
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json(result.data);
  } catch (error) { return createApiErrorResponse(error, "Unable to save affiliate."); }
}
