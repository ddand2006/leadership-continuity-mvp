// Private release. Broader access requires an explicit code and database rollout.
export function canAccessCoachingPreview(user: { email?: string | null } | null | undefined) {
  return user?.email?.trim().toLowerCase() === 'david@cycleofbusiness.com';
}
