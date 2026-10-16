import { NextResponse } from "next/server";
import { z } from "zod";
import { coachingContext } from "@/lib/coaching/server";
import { ApiRouteError, createApiErrorResponse } from "@/lib/api-route";
export async function POST(request: Request) {
  try {
    const { db, coach } = await coachingContext();
    if (!coach) throw new ApiRouteError("Coach account required.", 403);
    const p = z.object({ id: z.string().uuid(), accepted: z.boolean() }).parse(await request.json());
    const result = await db.rpc("confirm_partner_coach", { roster: p.id, accepted: p.accepted });
    if (result.error) throw new ApiRouteError(result.error.message, 403);
    return NextResponse.json({ status: result.data });
  } catch (error) { return createApiErrorResponse(error, "Unable to update affiliation."); }
}
