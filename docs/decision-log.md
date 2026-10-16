# Decision Log

What was decided, when, and why. **Decisions only** - not specs, not current state, not
implementation details. Reference issue IDs instead of embedding detail: the ticket owns WHAT
was built, this file owns WHY it was decided that way.

**There is no length cap, and do not add one without measuring first.** The obvious rule to
write here is "one line per decision, never more than two", and it does not survive contact
with a real log. Measured across the whole life of the log this template was extracted from:
**2 entries out of 540 came in under 200 characters, and both were bookkeeping notes rather
than decisions** - none of the oldest 100, none of the newest 100, with mean entry length
growing from 481 to 1447 characters. A rule with a 0.4% compliance rate is not a strict rule,
it is a fiction that makes every real entry read as a violation, and rules nobody satisfies
teach agents that the rules here are decorative.

So: one line is fine when one line is enough. The reasoning is usually the part worth having
later, so spend the words where it is load-bearing and stop when it stops.

Format: `- **YYYY-MM-DD** - Decision description. See <issue-ref>.`

---

- **2026-09-30** - Keep the existing Next.js, Supabase, and local component architecture as the
  project foundation while adding Trellis-style documentation around it. The goal is to improve
  continuity and organization without replacing working application conventions.

- **2026-10-13** - Partner approval creates a linked, unpublished affiliate draft with zero
  commission defaults; negotiated terms and publication remain explicit platform decisions.
  Partner ownership and team permissions use user-ID membership independently of payout email.
  Coach affiliations require the coach’s acceptance and reuse one coach profile. Subscription
  referral commissions and coach compensation remain separate; live coaching commerce stays in
  test mode until its provider rollout is explicitly enabled. See `docs/partner-workflows.md`.

- **2026-10-15** - Affiliate payout requests retain their Stripe idempotency key for uncertain
  outcomes and lost receipts. A definitive insufficient-funds rejection is audited and
  atomically retires only its matching request, returning the commission for a fresh admin
  approval. This avoids Stripe v1 replaying a cached rejection after funding while preventing
  stale responses from reopening a newer or completed transfer.

### October 15, 2026 — Email-link identity is authoritative during confirmation

Signup, invite, and recovery completion uses the session returned by the explicit email-link
exchange. Background auth events and an already-open account cannot finish those flows.
Provider URL errors are shown before any session work; missing verification data fails closed.
Ordinary sign-in confirmation without one of these sensitive flow modes retains its existing
session fallback. This prevents a stale browser session from claiming enrollment or password
setup while another person's email link is being verified.

- **2026-10-15** - A coach earnings read reconciles an incomplete Stripe Connect account from
  Stripe before showing payout readiness, then stops polling once the stored account is active.
  Connected `account.updated` webhooks remain the normal update path; the authenticated refresh
  closes the return-path gap when a platform webhook destination does not receive connected-
  account events.

- **2026-10-16** - Affiliate commission eligibility follows the current Stripe dispute outcome,
  while the charge's historical `disputed` flag only prompts that status lookup. Open and lost
  disputes keep commission blocked; `won`, `prevented`, and `warning_closed` outcomes release
  the verified commission. This keeps chargebacks conservative without permanently withholding
  a commission after the platform wins or prevents the dispute.

- **2026-10-16** - Hostinger is the sole production deployment target. Disable Vercel's automatic
  Git deployments in repository configuration so a merge to `main` cannot create a parallel
  Vercel production release while Hostinger deploys the same commit. See
  `docs/hostinger-business-deploy.md`.
