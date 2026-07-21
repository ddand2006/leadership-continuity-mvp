export type OrganizationAwardTier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum";

export type OrganizationAwardRoleSummary = {
  roleId: string;
  roleTitle: string;
  roleRank: number;
  successorCount: number;
  coveredSuccessorCount: number;
  goldReadySuccessorCount: number;
  isCovered: boolean;
  isTwoDeep: boolean;
  isProtected: boolean;
};

export type OrganizationAward = {
  tier: OrganizationAwardTier | null;
  label: string;
  description: string;
  nextStep: string;
  rolePriorityMode: "visible_role_order";
  topPriorityRoleCount: number;
  coveredTopPriorityRoleCount: number;
  twoDeepTopPriorityRoleCount: number;
  protectedTopPriorityRoleCount: number;
  protectedRoleCount: number;
  coveredRoleCount: number;
  topPriorityRoles: OrganizationAwardRoleSummary[];
  protectedRoles: OrganizationAwardRoleSummary[];
};

function buildOrganizationAward(
  tier: OrganizationAwardTier | null,
  values: Omit<
    OrganizationAward,
    "tier" | "label" | "description" | "nextStep"
  > & {
    description: string;
    nextStep: string;
  },
): OrganizationAward {
  const { description, nextStep, ...rest } = values;

  return {
    tier,
    label:
      tier === null
        ? "No award yet"
        : `${tier[0].toUpperCase()}${tier.slice(1)} Organization`,
    description,
    nextStep,
    ...rest,
  };
}

export function computeOrganizationAward(input: {
  roles: Array<{
    id: string;
    title: string;
  }>;
  roleBench: Array<{
    roleId: string;
    coveredSuccessorCount: number;
    goldReadySuccessorCount: number;
    successorCount: number;
  }>;
}): OrganizationAward {
  const roleBenchById = new Map(
    input.roleBench.map((role) => [role.roleId, role]),
  );
  const roleSummaries = input.roles.map((role, index) => {
    const bench = roleBenchById.get(role.id);
    const coveredSuccessorCount = bench?.coveredSuccessorCount ?? 0;
    const goldReadySuccessorCount = bench?.goldReadySuccessorCount ?? 0;
    const successorCount = bench?.successorCount ?? 0;

    return {
      roleId: role.id,
      roleTitle: role.title,
      roleRank: index + 1,
      successorCount,
      coveredSuccessorCount,
      goldReadySuccessorCount,
      isCovered: coveredSuccessorCount >= 1,
      isTwoDeep: coveredSuccessorCount >= 2,
      isProtected: goldReadySuccessorCount >= 2,
    } satisfies OrganizationAwardRoleSummary;
  });

  const topPriorityRoles = roleSummaries.slice(0, 3);
  const coveredTopPriorityRoleCount = topPriorityRoles.filter(
    (role) => role.isCovered,
  ).length;
  const twoDeepTopPriorityRoleCount = topPriorityRoles.filter(
    (role) => role.isTwoDeep,
  ).length;
  const protectedTopPriorityRoleCount = topPriorityRoles.filter(
    (role) => role.isProtected,
  ).length;
  const protectedRoles = roleSummaries.filter((role) => role.isProtected);
  const protectedRoleCount = protectedRoles.length;
  const coveredRoleCount = roleSummaries.filter((role) => role.isCovered).length;

  const baseValues = {
    rolePriorityMode: "visible_role_order" as const,
    topPriorityRoleCount: topPriorityRoles.length,
    coveredTopPriorityRoleCount,
    twoDeepTopPriorityRoleCount,
    protectedTopPriorityRoleCount,
    protectedRoleCount,
    coveredRoleCount,
    topPriorityRoles,
    protectedRoles,
  };

  if (protectedRoleCount >= 5) {
    return buildOrganizationAward("platinum", {
      ...baseValues,
      description:
        "Five or more visible roles are fully protected with two Gold-ready successors each.",
      nextStep:
        "Maintain review cadence and keep the protected bench current across the wider organization.",
    });
  }

  if (
    topPriorityRoles.length >= 3 &&
    protectedTopPriorityRoleCount >= 3
  ) {
    return buildOrganizationAward("gold", {
      ...baseValues,
      description:
        "The top three visible roles are fully protected with two Gold-ready successors each.",
      nextStep:
        "Expand the same protected-bench standard to five or more roles to reach Platinum.",
    });
  }

  if (
    topPriorityRoles.length >= 3 &&
    coveredTopPriorityRoleCount >= 3 &&
    twoDeepTopPriorityRoleCount >= 2 &&
    protectedTopPriorityRoleCount >= 1
  ) {
    return buildOrganizationAward("silver", {
      ...baseValues,
      description:
        "All top-priority roles are covered, two of them are already two-deep, and at least one is fully protected.",
      nextStep:
        "Move every top-three role to two Gold-ready successors to reach Gold.",
    });
  }

  if (
    coveredTopPriorityRoleCount >= Math.min(2, topPriorityRoles.length) &&
    twoDeepTopPriorityRoleCount >= 1
  ) {
    return buildOrganizationAward("bronze", {
      ...baseValues,
      description:
        "Bench coverage is forming across the top visible roles, with at least one role already two-deep.",
      nextStep:
        "Cover all top-three roles and protect at least one of them to reach Silver.",
    });
  }

  return buildOrganizationAward(null, {
    ...baseValues,
    description:
      "The visible role bench is not yet broad or deep enough to qualify for an organization award.",
    nextStep:
      "Start by covering the top visible roles with at least one Silver-ready or better successor, then build two-deep protection.",
  });
}
