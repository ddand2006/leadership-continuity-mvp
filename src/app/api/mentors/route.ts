import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiRouteError,
  createApiErrorResponse,
  requireApiWorkspaceProfile,
} from "@/lib/api-route";

const createMentorSchema = z.object({
  full_name: z.string().trim().min(1, "Mentor name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  position_title: z.string().trim().min(1, "Position is required."),
});

function generateTemporaryPassword() {
  return `Mentor-${randomBytes(9).toString("base64url")}!7a`;
}

export async function POST(request: Request) {
  try {
    const { admin, profile } = await requireApiWorkspaceProfile({
      requireAdmin: true,
    });
    const payload = createMentorSchema.parse(await request.json());

    const existingProfileResult = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", profile.organization_id)
      .eq("email", payload.email)
      .maybeSingle();

    if (existingProfileResult.error) {
      throw new ApiRouteError(existingProfileResult.error.message, 500);
    }

    if (existingProfileResult.data) {
      throw new ApiRouteError(
        `A user with email ${payload.email} already exists in this organization.`,
        409,
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const authCreateResult = await admin.auth.admin.createUser({
      email: payload.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: payload.full_name,
        role: "mentor",
      },
    });

    if (authCreateResult.error || !authCreateResult.data.user) {
      throw new ApiRouteError(
        authCreateResult.error?.message ?? "Unable to create the mentor login.",
        500,
      );
    }

    const insertProfileResult = await admin
      .from("profiles")
      .insert({
        auth_user_id: authCreateResult.data.user.id,
        organization_id: profile.organization_id,
        full_name: payload.full_name,
        email: payload.email,
        role: "mentor",
        position_title: payload.position_title,
      })
      .select("id, full_name, email, position_title")
      .single();

    if (insertProfileResult.error) {
      await admin.auth.admin.deleteUser(authCreateResult.data.user.id);
      throw new ApiRouteError(insertProfileResult.error.message, 500);
    }

    return NextResponse.json({
      message: `Mentor "${insertProfileResult.data.full_name}" created.`,
      mentor: insertProfileResult.data,
      loginEmail: payload.email,
      temporaryPassword,
    });
  } catch (error) {
    return createApiErrorResponse(error, "Unexpected mentor creation failure.");
  }
}
