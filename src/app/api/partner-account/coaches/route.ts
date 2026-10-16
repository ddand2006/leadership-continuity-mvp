import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiRouteError, createApiErrorResponse } from "@/lib/api-route";
import { requirePartnerContext, resolvePartnerInvitee } from "@/lib/partner-account";

const input = z.object({ name: z.string().trim().min(2).max(200), email: z.string().trim().email(), specialty: z.string().trim().max(200).optional() });

export async function POST(request: Request) {
  try {
    const { admin, application } = await requirePartnerContext(true);
    const validation = input.safeParse(await request.json());
    if (!validation.success) throw new ApiRouteError("Enter a valid coach name, email, and specialty.", 400);
    const parsed = validation.data;
    const identity = await resolvePartnerInvitee(parsed.email, "/coaching/onboarding", parsed.name);
    const result = await admin.rpc("link_partner_coach", {
      application: application.id, coach_user: identity.userId,
      coach_name: parsed.name, coach_email: parsed.email.toLowerCase(), specialty: parsed.specialty ?? "",
    });
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ coach: result.data, message: identity.invitationSent
      ? "Invitation sent. The coach can complete their profile and confirm your affiliation."
      : "Existing coach account linked. Ask the coach to sign in and confirm the affiliation in Marketplace Readiness." });
  } catch (error) {
    return createApiErrorResponse(error, "Unable to add coach.");
  }
}
