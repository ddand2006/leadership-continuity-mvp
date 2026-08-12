export function getCandidateDisplayName(
  fullName: string | null | undefined,
) {
  return fullName?.trim() || "Candidate name not entered";
}
