const VP_PATIENT_CARE_SERVICES_TITLE = "VP - Patient Care Services";

export function canonicalizeRoleTitle(value: string | null | undefined) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return "";
  }

  const normalizedValue = trimmedValue
    .toLowerCase()
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ");

  if (
    normalizedValue === "assistant administrator of patient care services" ||
    normalizedValue === "assistant administrator of patient care services (aapcs)" ||
    normalizedValue === "aapcs" ||
    normalizedValue === "vp patient care services" ||
    normalizedValue === "vp - patient care services" ||
    normalizedValue === "vp patient care services / cno" ||
    normalizedValue === "vp patient care services/cno"
  ) {
    return VP_PATIENT_CARE_SERVICES_TITLE;
  }

  return trimmedValue;
}
