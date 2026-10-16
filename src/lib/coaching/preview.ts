// The server supplies roles from the signed-in database context, never metadata.
// Verification, suspension, organization, engagement, and consent checks run separately.
export function canAccessCoachingWorkspace(role: string | null | undefined, hasCoach: boolean) {
  return hasCoach || ['system_admin', 'hospital_admin', 'candidate', 'mentor'].includes(role ?? '');
}
