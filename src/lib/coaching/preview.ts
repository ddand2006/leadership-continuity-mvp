// Private release. Broader access requires an explicit code and database rollout.
export function canAccessCoachingPreview(user: { email?: string | null } | null | undefined) {
  const email = user?.email?.trim().toLowerCase();
  const allowedEmails = new Set(['david@cycleofbusiness.com']);

  // The local Supabase fixture uses a plus-addressed account. Keep it out of
  // production so the private coaching preview remains restricted there.
  if (process.env.NODE_ENV !== 'production') {
    allowedEmails.add('david+local@cycleofbusiness.com');
  }

  return Boolean(email && allowedEmails.has(email));
}
