import type { RoleCandidateCharacteristicInput } from "@/lib/role-characteristics";

export function normalizeRoleLibraryCharacteristic(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isMissingRoleCharacteristicLibraryTableError(error: {
  message: string;
} | null) {
  return Boolean(
    error?.message.includes("role_characteristic_library") &&
      error.message.includes("schema cache"),
  );
}

export async function syncRoleCharacteristicLibrary(options: {
  admin: {
    from: (table: string) => {
      upsert: (
        values: Array<Record<string, unknown>>,
        options?: { onConflict?: string },
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
  organizationId: string;
  items: RoleCandidateCharacteristicInput[];
}) {
  if (options.items.length === 0) {
    return;
  }

  const upsertResult = await options.admin.from("role_characteristic_library").upsert(
    options.items.map((item) => ({
      organization_id: options.organizationId,
      category: item.category,
      characteristic: item.characteristic,
      normalized_characteristic: normalizeRoleLibraryCharacteristic(
        item.characteristic,
      ),
    })),
    {
      onConflict: "organization_id,category,normalized_characteristic",
    },
  );

  if (upsertResult.error) {
    if (isMissingRoleCharacteristicLibraryTableError(upsertResult.error)) {
      return;
    }

    throw new Error(upsertResult.error.message);
  }
}
