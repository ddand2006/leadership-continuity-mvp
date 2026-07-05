import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiRouteError } from "@/lib/api-route";
import { getAppUrl } from "@/lib/env";
import {
  buildFullName,
  getCandidateProgramStatus,
  getOrganizationUserLegacyRole,
  normalizeEmail,
  organizationUserInputBaseSchema,
  organizationUserInputSchema,
  type OrganizationUserAdminRole,
  type OrganizationUserRecord,
  type OrganizationUserStatus,
} from "@/lib/organization-users";

const PASSWORD_BAN_DURATION = "876000h";

const organizationUserSelection = `
  id,
  organization_id,
  auth_user_id,
  profile_id,
  candidate_id,
  first_name,
  last_name,
  email,
  is_candidate,
  is_mentor,
  admin_role,
  status,
  invited_at,
  activated_at,
  suspended_at,
  archived_at,
  last_login_at,
  created_at,
  updated_at
`;

const createUserSchema = organizationUserInputSchema.extend({
  password: z.string().min(8).max(128),
});

const inviteUserSchema = organizationUserInputBaseSchema
  .omit({ status: true })
  .refine(
    (value) => value.isCandidate || value.isMentor || value.adminRole !== "none",
    {
      message: "Choose at least one user type or an admin role.",
      path: ["adminRole"],
    },
  );

const passwordResetSchema = z.object({
  userId: z.string().uuid(),
  temporaryPassword: z.string().trim().min(8).max(128).optional(),
});

function getBannedDurationForStatus(status: OrganizationUserStatus) {
  return status === "suspended" || status === "archived"
    ? PASSWORD_BAN_DURATION
    : "none";
}

function getStatusTimestamps(
  previousStatus: OrganizationUserStatus | null,
  nextStatus: OrganizationUserStatus,
) {
  const now = new Date().toISOString();

  return {
    invitedAt: nextStatus === "invited" && previousStatus !== "invited" ? now : null,
    activatedAt:
      nextStatus === "active" && previousStatus !== "active" ? now : null,
    suspendedAt:
      nextStatus === "suspended" && previousStatus !== "suspended" ? now : null,
    archivedAt:
      nextStatus === "archived" && previousStatus !== "archived" ? now : null,
  };
}

async function countRowsByReference(options: {
  admin: SupabaseClient;
  table: string;
  column: string;
  value: string;
}) {
  const result = await options.admin
    .from(options.table)
    .select("id", { count: "exact", head: true })
    .eq(options.column, options.value);

  if (result.error) {
    throw new ApiRouteError(result.error.message, 500);
  }

  return (result.count ?? 0) > 0;
}

export async function hasHistoricalProgramData(options: {
  admin: SupabaseClient;
  candidateId: string | null;
  profileId: string | null;
}) {
  const checks: Promise<boolean>[] = [];

  if (options.candidateId) {
    for (const [table, column] of [
      ["candidate_strengths", "candidate_id"],
      ["candidate_source_documents", "candidate_id"],
      ["candidate_role_considerations", "candidate_id"],
      ["candidate_role_strength_assessments", "candidate_id"],
      ["mentor_reports", "candidate_id"],
      ["candidate_project_assignments", "candidate_id"],
      ["interview_panels", "candidate_id"],
      ["mentor_role_assignments", "candidate_id"],
      ["development_records", "candidate_id"],
      ["mentoring_preparation_worksheets", "candidate_id"],
      ["mentoring_departmental_project_worksheets", "candidate_id"],
      ["mentoring_cross_departmental_project_worksheets", "candidate_id"],
    ] as const) {
      checks.push(
        countRowsByReference({
          admin: options.admin,
          table,
          column,
          value: options.candidateId,
        }),
      );
    }
  }

  if (options.profileId) {
    for (const [table, column] of [
      ["interview_scores", "interviewer_profile_id"],
      ["mentor_reports", "generated_by"],
      ["candidate_project_assignments", "mentor_profile_id"],
      ["mentor_role_assignments", "mentor_profile_id"],
      ["role_mentor_assignments", "mentor_profile_id"],
      ["development_records", "mentor_id"],
      ["development_records", "created_by_profile_id"],
      ["mentoring_preparation_worksheets", "mentor_profile_id"],
      ["mentoring_preparation_worksheets", "created_by_profile_id"],
      ["mentoring_departmental_project_worksheets", "mentor_profile_id"],
      ["mentoring_departmental_project_worksheets", "created_by_profile_id"],
      ["mentoring_cross_departmental_project_worksheets", "mentor_profile_id"],
      ["mentoring_cross_departmental_project_worksheets", "created_by_profile_id"],
      ["role_composite_documents", "created_by_profile_id"],
      ["candidate_source_documents", "created_by_profile_id"],
    ] as const) {
      checks.push(
        countRowsByReference({
          admin: options.admin,
          table,
          column,
          value: options.profileId,
        }),
      );
    }
  }

  const results = await Promise.all(checks);
  return results.some(Boolean);
}

async function updateAuthUserAccess(options: {
  admin: SupabaseClient;
  authUserId: string;
  email?: string;
  password?: string;
  firstName: string;
  lastName: string;
  status: OrganizationUserStatus;
}) {
  const updateResult = await options.admin.auth.admin.updateUserById(
    options.authUserId,
    {
      ...(options.email ? { email: normalizeEmail(options.email) } : {}),
      ...(options.password ? { password: options.password } : {}),
      email_confirm: true,
      ban_duration: getBannedDurationForStatus(options.status),
      user_metadata: {
        full_name: buildFullName(options.firstName, options.lastName),
        first_name: options.firstName,
        last_name: options.lastName,
      },
    },
  );

  if (updateResult.error) {
    throw new ApiRouteError(updateResult.error.message, 400);
  }
}

async function ensureOrganizationUserAbsent(options: {
  admin: SupabaseClient;
  organizationId: string;
  email: string;
}) {
  const existingResult = await options.admin
    .from("organization_users")
    .select("id")
    .eq("organization_id", options.organizationId)
    .eq("email", normalizeEmail(options.email))
    .maybeSingle();

  if (existingResult.error) {
    throw new ApiRouteError(existingResult.error.message, 500);
  }

  if (existingResult.data) {
    throw new ApiRouteError(
      "A user with this email already exists in this organization.",
      409,
    );
  }
}

async function upsertProfile(options: {
  admin: SupabaseClient;
  profileId: string | null;
  organizationId: string;
  authUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  isCandidate: boolean;
  isMentor: boolean;
  adminRole: OrganizationUserAdminRole;
}) {
  const payload = {
    auth_user_id: options.authUserId,
    organization_id: options.organizationId,
    full_name: buildFullName(options.firstName, options.lastName),
    email: normalizeEmail(options.email),
    role: getOrganizationUserLegacyRole({
      isCandidate: options.isCandidate,
      isMentor: options.isMentor,
      adminRole: options.adminRole,
    }),
  };

  if (options.profileId) {
    const updateResult = await options.admin
      .from("profiles")
      .update(payload)
      .eq("id", options.profileId)
      .select("id")
      .single();

    if (updateResult.error) {
      throw new ApiRouteError(updateResult.error.message, 400);
    }

    return updateResult.data.id;
  }

  const insertResult = await options.admin
    .from("profiles")
    .insert(payload)
    .select("id")
    .single();

  if (insertResult.error) {
    throw new ApiRouteError(insertResult.error.message, 400);
  }

  return insertResult.data.id;
}

async function syncCandidateRecord(options: {
  admin: SupabaseClient;
  organizationId: string;
  candidateId: string | null;
  firstName: string;
  lastName: string;
  isCandidate: boolean;
  status: OrganizationUserStatus;
}) {
  if (options.isCandidate) {
    const candidatePayload = {
      organization_id: options.organizationId,
      full_name: buildFullName(options.firstName, options.lastName),
      status: getCandidateProgramStatus(options.status),
    };

    if (options.candidateId) {
      const updateResult = await options.admin
        .from("candidates")
        .update(candidatePayload)
        .eq("id", options.candidateId)
        .select("id")
        .single();

      if (updateResult.error) {
        throw new ApiRouteError(updateResult.error.message, 400);
      }

      return updateResult.data.id;
    }

    const insertResult = await options.admin
      .from("candidates")
      .insert(candidatePayload)
      .select("id")
      .single();

    if (insertResult.error) {
      throw new ApiRouteError(insertResult.error.message, 400);
    }

    return insertResult.data.id;
  }

  if (!options.candidateId) {
    return null;
  }

  const hasHistory = await hasHistoricalProgramData({
    admin: options.admin,
    candidateId: options.candidateId,
    profileId: null,
  });

  if (hasHistory) {
    throw new ApiRouteError(
      "Candidate type cannot be removed because historical program data exists. Suspend or archive this user instead.",
      409,
    );
  }

  const deleteResult = await options.admin
    .from("candidates")
    .delete()
    .eq("id", options.candidateId);

  if (deleteResult.error) {
    throw new ApiRouteError(deleteResult.error.message, 400);
  }

  return null;
}

export async function loadOrganizationUser(options: {
  admin: SupabaseClient;
  organizationId: string;
  userId: string;
}) {
  const result = await options.admin
    .from("organization_users")
    .select(organizationUserSelection)
    .eq("organization_id", options.organizationId)
    .eq("id", options.userId)
    .maybeSingle();

  if (result.error) {
    throw new ApiRouteError(result.error.message, 500);
  }

  if (!result.data) {
    throw new ApiRouteError("User not found.", 404);
  }

  return result.data as OrganizationUserRecord;
}

export async function createManagedUser(options: {
  admin: SupabaseClient;
  organizationId: string;
  actorProfileId: string;
  input: unknown;
}) {
  const parsed = createUserSchema.safeParse(options.input);

  if (!parsed.success) {
    throw new ApiRouteError(parsed.error.issues[0]?.message ?? "Invalid user.", 400);
  }

  const input = parsed.data;
  await ensureOrganizationUserAbsent({
    admin: options.admin,
    organizationId: options.organizationId,
    email: input.email,
  });

  const authResult = await options.admin.auth.admin.createUser({
    email: normalizeEmail(input.email),
    password: input.password,
    email_confirm: true,
    ban_duration: getBannedDurationForStatus(input.status),
    user_metadata: {
      full_name: buildFullName(input.firstName, input.lastName),
      first_name: input.firstName,
      last_name: input.lastName,
    },
  });

  if (authResult.error || !authResult.data.user) {
    throw new ApiRouteError(
      authResult.error?.message ?? "Unable to create auth user.",
      400,
    );
  }

  const authUserId = authResult.data.user.id;
  const profileId = await upsertProfile({
    admin: options.admin,
    profileId: null,
    organizationId: options.organizationId,
    authUserId,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    isCandidate: input.isCandidate,
    isMentor: input.isMentor,
    adminRole: input.adminRole,
  });
  const candidateId = await syncCandidateRecord({
    admin: options.admin,
    organizationId: options.organizationId,
    candidateId: null,
    firstName: input.firstName,
    lastName: input.lastName,
    isCandidate: input.isCandidate,
    status: input.status,
  });
  const timestamps = getStatusTimestamps(null, input.status);

  const insertResult = await options.admin
    .from("organization_users")
    .insert({
      organization_id: options.organizationId,
      auth_user_id: authUserId,
      profile_id: profileId,
      candidate_id: candidateId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: normalizeEmail(input.email),
      is_candidate: input.isCandidate,
      is_mentor: input.isMentor,
      admin_role: input.adminRole,
      status: input.status,
      invited_at: timestamps.invitedAt,
      activated_at: timestamps.activatedAt,
      suspended_at: timestamps.suspendedAt,
      archived_at: timestamps.archivedAt,
      created_by_profile_id: options.actorProfileId,
      updated_by_profile_id: options.actorProfileId,
    })
    .select("id")
    .single();

  if (insertResult.error) {
    throw new ApiRouteError(insertResult.error.message, 400);
  }

  revalidatePath("/administration");
  revalidatePath("/candidates");
  revalidatePath("/mentoring");
  return { message: "User added successfully." };
}

export async function inviteManagedUser(options: {
  admin: SupabaseClient;
  organizationId: string;
  actorProfileId: string;
  input: unknown;
}) {
  const parsed = inviteUserSchema.safeParse(options.input);

  if (!parsed.success) {
    throw new ApiRouteError(parsed.error.issues[0]?.message ?? "Invalid user.", 400);
  }

  const input = parsed.data;
  await ensureOrganizationUserAbsent({
    admin: options.admin,
    organizationId: options.organizationId,
    email: input.email,
  });

  const inviteResult = await options.admin.auth.admin.inviteUserByEmail(
    normalizeEmail(input.email),
    {
      data: {
        full_name: buildFullName(input.firstName, input.lastName),
        first_name: input.firstName,
        last_name: input.lastName,
      },
      redirectTo: `${getAppUrl()}/auth/callback?next=/`,
    },
  );

  if (inviteResult.error || !inviteResult.data.user) {
    throw new ApiRouteError(
      inviteResult.error?.message ?? "Unable to send invite.",
      400,
    );
  }

  const authUserId = inviteResult.data.user.id;
  const profileId = await upsertProfile({
    admin: options.admin,
    profileId: null,
    organizationId: options.organizationId,
    authUserId,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    isCandidate: input.isCandidate,
    isMentor: input.isMentor,
    adminRole: input.adminRole,
  });
  const candidateId = await syncCandidateRecord({
    admin: options.admin,
    organizationId: options.organizationId,
    candidateId: null,
    firstName: input.firstName,
    lastName: input.lastName,
    isCandidate: input.isCandidate,
    status: "invited",
  });

  const insertResult = await options.admin
    .from("organization_users")
    .insert({
      organization_id: options.organizationId,
      auth_user_id: authUserId,
      profile_id: profileId,
      candidate_id: candidateId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: normalizeEmail(input.email),
      is_candidate: input.isCandidate,
      is_mentor: input.isMentor,
      admin_role: input.adminRole,
      status: "invited",
      invited_at: new Date().toISOString(),
      created_by_profile_id: options.actorProfileId,
      updated_by_profile_id: options.actorProfileId,
    })
    .select("id")
    .single();

  if (insertResult.error) {
    throw new ApiRouteError(insertResult.error.message, 400);
  }

  revalidatePath("/administration");
  revalidatePath("/candidates");
  revalidatePath("/mentoring");
  return { message: "Invitation sent successfully." };
}

export async function updateManagedUser(options: {
  admin: SupabaseClient;
  organizationId: string;
  actorProfileId: string;
  userId: string;
  input: unknown;
}) {
  const parsed = organizationUserInputSchema.safeParse(options.input);

  if (!parsed.success) {
    throw new ApiRouteError(parsed.error.issues[0]?.message ?? "Invalid user.", 400);
  }

  const current = await loadOrganizationUser({
    admin: options.admin,
    organizationId: options.organizationId,
    userId: options.userId,
  });
  const input = parsed.data;
  const normalizedEmail = normalizeEmail(input.email);

  if (normalizedEmail !== current.email) {
    await ensureOrganizationUserAbsent({
      admin: options.admin,
      organizationId: options.organizationId,
      email: normalizedEmail,
    });
  }

  if (current.auth_user_id) {
    await updateAuthUserAccess({
      admin: options.admin,
      authUserId: current.auth_user_id,
      email: normalizedEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      status: input.status,
    });
  }

  const profileId = current.auth_user_id
    ? await upsertProfile({
        admin: options.admin,
        profileId: current.profile_id,
        organizationId: options.organizationId,
        authUserId: current.auth_user_id,
        email: normalizedEmail,
        firstName: input.firstName,
        lastName: input.lastName,
        isCandidate: input.isCandidate,
        isMentor: input.isMentor,
        adminRole: input.adminRole,
      })
    : current.profile_id;
  const candidateId = await syncCandidateRecord({
    admin: options.admin,
    organizationId: options.organizationId,
    candidateId: current.candidate_id,
    firstName: input.firstName,
    lastName: input.lastName,
    isCandidate: input.isCandidate,
    status: input.status,
  });
  const timestamps = getStatusTimestamps(current.status, input.status);

  const updateResult = await options.admin
    .from("organization_users")
    .update({
      profile_id: profileId,
      candidate_id: candidateId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: normalizedEmail,
      is_candidate: input.isCandidate,
      is_mentor: input.isMentor,
      admin_role: input.adminRole,
      status: input.status,
      invited_at: timestamps.invitedAt ?? current.invited_at,
      activated_at:
        input.status === "active"
          ? timestamps.activatedAt ?? current.activated_at ?? new Date().toISOString()
          : current.activated_at,
      suspended_at:
        input.status === "suspended"
          ? timestamps.suspendedAt ?? current.suspended_at ?? new Date().toISOString()
          : input.status === "active"
            ? null
            : current.suspended_at,
      archived_at:
        input.status === "archived"
          ? timestamps.archivedAt ?? current.archived_at ?? new Date().toISOString()
          : input.status === "active"
            ? null
            : current.archived_at,
      updated_by_profile_id: options.actorProfileId,
    })
    .eq("id", options.userId);

  if (updateResult.error) {
    throw new ApiRouteError(updateResult.error.message, 400);
  }

  revalidatePath("/administration");
  revalidatePath("/candidates");
  revalidatePath("/mentoring");
  return { message: "User updated successfully." };
}

export async function updateManagedUserStatus(options: {
  admin: SupabaseClient;
  organizationId: string;
  actorProfileId: string;
  actorAuthUserId: string;
  userId: string;
  status: OrganizationUserStatus;
}) {
  const current = await loadOrganizationUser({
    admin: options.admin,
    organizationId: options.organizationId,
    userId: options.userId,
  });

  if (
    current.auth_user_id &&
    current.auth_user_id === options.actorAuthUserId &&
    options.status !== "active"
  ) {
    throw new ApiRouteError(
      "You cannot suspend or archive your own account.",
      409,
    );
  }

  return updateManagedUser({
    admin: options.admin,
    organizationId: options.organizationId,
    actorProfileId: options.actorProfileId,
    userId: options.userId,
    input: {
      firstName: current.first_name,
      lastName: current.last_name,
      email: current.email,
      isCandidate: current.is_candidate,
      isMentor: current.is_mentor,
      adminRole: current.admin_role,
      status: options.status,
    },
  });
}

export async function resetManagedUserPassword(options: {
  admin: SupabaseClient;
  organizationId: string;
  actorProfileId: string;
  input: unknown;
}) {
  const parsed = passwordResetSchema.safeParse(options.input);

  if (!parsed.success) {
    throw new ApiRouteError(
      parsed.error.issues[0]?.message ?? "Invalid password request.",
      400,
    );
  }

  const current = await loadOrganizationUser({
    admin: options.admin,
    organizationId: options.organizationId,
    userId: parsed.data.userId,
  });

  if (!current.auth_user_id) {
    throw new ApiRouteError("This user does not have an auth account yet.", 409);
  }

  if (parsed.data.temporaryPassword) {
    await updateAuthUserAccess({
      admin: options.admin,
      authUserId: current.auth_user_id,
      password: parsed.data.temporaryPassword,
      firstName: current.first_name,
      lastName: current.last_name,
      status: current.status,
    });

    return { message: "Temporary password updated successfully." };
  }

  const linkResult = await options.admin.auth.admin.generateLink({
    type: "recovery",
    email: current.email,
    options: {
      redirectTo: `${getAppUrl()}/auth/callback?next=/`,
    },
  });

  if (linkResult.error) {
    throw new ApiRouteError(linkResult.error.message, 400);
  }

  return {
    message: "Password reset link generated successfully.",
    resetLink: linkResult.data.properties.action_link,
  };
}

export async function deleteManagedUser(options: {
  admin: SupabaseClient;
  organizationId: string;
  actorAuthUserId: string;
  userId: string;
}) {
  const current = await loadOrganizationUser({
    admin: options.admin,
    organizationId: options.organizationId,
    userId: options.userId,
  });

  if (current.auth_user_id && current.auth_user_id === options.actorAuthUserId) {
    throw new ApiRouteError("You cannot delete your own account.", 409);
  }

  const hasHistory = await hasHistoricalProgramData({
    admin: options.admin,
    candidateId: current.candidate_id,
    profileId: current.profile_id,
  });

  if (hasHistory) {
    throw new ApiRouteError(
      "This user has retained leadership development data and cannot be permanently deleted.",
      409,
    );
  }

  if (current.candidate_id) {
    const candidateDeleteResult = await options.admin
      .from("candidates")
      .delete()
      .eq("id", current.candidate_id);

    if (candidateDeleteResult.error) {
      throw new ApiRouteError(candidateDeleteResult.error.message, 400);
    }
  }

  if (current.profile_id) {
    const profileDeleteResult = await options.admin
      .from("profiles")
      .delete()
      .eq("id", current.profile_id);

    if (profileDeleteResult.error) {
      throw new ApiRouteError(profileDeleteResult.error.message, 400);
    }
  }

  const userDeleteResult = await options.admin
    .from("organization_users")
    .delete()
    .eq("id", options.userId);

  if (userDeleteResult.error) {
    throw new ApiRouteError(userDeleteResult.error.message, 400);
  }

  if (current.auth_user_id) {
    const authDeleteResult = await options.admin.auth.admin.deleteUser(
      current.auth_user_id,
    );

    if (authDeleteResult.error) {
      throw new ApiRouteError(authDeleteResult.error.message, 400);
    }
  }

  revalidatePath("/administration");
  revalidatePath("/candidates");
  revalidatePath("/mentoring");
  return { message: "User deleted permanently." };
}

export async function syncOrganizationUserAccessOnLogin(options: {
  admin: SupabaseClient;
  authUserId: string;
}) {
  const result = await options.admin
    .from("organization_users")
    .select(organizationUserSelection)
    .eq("auth_user_id", options.authUserId)
    .maybeSingle();

  if (result.error) {
    throw new ApiRouteError(result.error.message, 500);
  }

  const account = result.data as OrganizationUserRecord | null;

  if (!account) {
    return null;
  }

  if (account.status === "suspended" || account.status === "archived") {
    return account;
  }

  const nextStatus = account.status === "invited" ? "active" : account.status;
  const now = new Date().toISOString();
  const updateResult = await options.admin
    .from("organization_users")
    .update({
      status: nextStatus,
      activated_at:
        nextStatus === "active"
          ? account.activated_at ?? now
          : account.activated_at,
      last_login_at: now,
    })
    .eq("id", account.id)
    .select(organizationUserSelection)
    .single();

  if (updateResult.error) {
    throw new ApiRouteError(updateResult.error.message, 500);
  }

  return updateResult.data as OrganizationUserRecord;
}

export async function loadAdministrationUsers(options: {
  admin: SupabaseClient;
  organizationId: string;
}) {
  const result = await options.admin
    .from("organization_users")
    .select(organizationUserSelection)
    .eq("organization_id", options.organizationId)
    .order("created_at", { ascending: true });

  if (result.error) {
    throw new ApiRouteError(result.error.message, 500);
  }

  const rows = (result.data ?? []) as OrganizationUserRecord[];
  const withHistory = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      hasHistoricalData: await hasHistoricalProgramData({
        admin: options.admin,
        candidateId: row.candidate_id,
        profileId: row.profile_id,
      }),
    })),
  );

  return withHistory;
}
