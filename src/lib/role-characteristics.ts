export const ROLE_CHARACTERISTIC_CATEGORIES = [
  "talent",
  "skill",
  "behavior",
] as const;

export type RoleCharacteristicCategory =
  (typeof ROLE_CHARACTERISTIC_CATEGORIES)[number];

export type RoleCandidateCharacteristicInput = {
  category: RoleCharacteristicCategory;
  characteristic: string;
  sort_order: number;
};

function cleanListItem(value: string) {
  return value
    .replace(/^[\s\-*•\d.)]+/, "")
    .trim();
}

function dedupeCharacteristics(items: RoleCandidateCharacteristicInput[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.category}:${item.characteristic.toLowerCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function parseCharacteristicsTextarea(
  category: RoleCharacteristicCategory,
  value: string,
) {
  const parts = value
    .split(/\n|;/g)
    .map((item) => cleanListItem(item))
    .filter(Boolean);

  return dedupeCharacteristics(
    parts.map((characteristic, index) => ({
      category,
      characteristic,
      sort_order: index,
    })),
  );
}

export function groupCharacteristicsByCategory(
  items: {
    category: string;
    characteristic: string;
  }[],
) {
  return {
    talents: items
      .filter((item) => item.category === "talent")
      .map((item) => item.characteristic),
    skills: items
      .filter((item) => item.category === "skill")
      .map((item) => item.characteristic),
    behaviors: items
      .filter((item) => item.category === "behavior")
      .map((item) => item.characteristic),
  };
}
