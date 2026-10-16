# Common Gotchas

- Stripe v1 caches an executed transfer's insufficient-funds error under its idempotency
  key. Funding the balance does not make that key succeed. Keep uncertain requests stable;
  only a verified `StripeInvalidRequestError` / `balance_insufficient` / HTTP 400 with a
  provider request ID can retire its matching reservation. Record the rejection before
  issuing a new request key, and require another administrator approval. Never reset a
  processing payout merely because a transfer search returned no matches.

- Stripe sandboxes can default Checkout to Managed Payments. A normal subscription checkout
  with a newly created product then fails with a missing product tax-code error. The isolated
  affiliate staging mode explicitly disables Managed Payments per session to rehearse direct
  platform charges and transfers; production retains its account defaults. Do not silently
  change account-wide tax settings to make a rehearsal pass.

Symptom → root cause → fix patterns discovered in this project. Agents: append a row after every
bug fix (see AGENTS.md § Autonomous Housekeeping). Check this table FIRST when diagnosing a bug -
the symptom may already be documented.

Keep entries terse: future sessions are the consumer and they have a limited attention budget.
Include a commit SHA and issue reference when known.

| Symptom | Root Cause | Fix | Date | Ref |
|---|---|---|---|---|
| Candidate preview loses its role context after opening a development link | Workspace links omitted the `viewAs=candidate` marker | Preserve the Candidate marker on links leaving the preview workspace | 2026-09-30 | `9350771` |
| Partner approval succeeds but the portal has no affiliate profile | Approval updated only the application status | Create/link the draft affiliate and owner membership in one retry-safe transaction | 2026-10-13 | `review_partner_application` |
| Re-inviting an existing coach loses its user link or duplicates roster entries | Auth invitation errors were treated as identity lookup, without a canonical profile | Resolve the auth identity on the server and reuse the coach profile and unique roster record | 2026-10-13 | `link_partner_coach` |
| A paid commission becomes payable again after a repeated webhook | Recalculation overwrote payout status | Preserve payout facts and record adjustments separately; use a reserved payout and stable Stripe keys | 2026-10-13 | `record_affiliate_earning` |
| Configured commission exclusions do not match calculated earnings | Calculator ignored frozen exclusion settings | Use verified receipt/refund/fee evidence and the original conversion anniversary | 2026-10-13 | `affiliate-commission.ts` |
| A PostgreSQL function fails with an ambiguous column reference | Parameter or local-variable names overlapped table columns | Use distinct local names and named conflict constraints; exercise functions in a disposable database | 2026-10-13 | `partner-workflows.sql` |
| Supabase preview Auth works but Data API returns permission denied on existing tables | New branches may lack legacy default CRUD grants even when schema and RLS are present | Compare explicit production ACLs and restore only missing baseline grants in staging; preserve private-table revocations and RLS | 2026-10-14 | `partner-staging-rollout.md` |
| A branch dry run lists already-applied historical migrations immediately after creation | Branch schema/history initialization has not settled | Confirm history and schema agree with the parent, then repeat the dry run before applying migrations | 2026-10-14 | `partner-staging-rollout.md` |
| `supabase db query --project-ref` rejects an explicit project target | This CLI requires `--linked` together with the project override | Pass both `--linked --project-ref <intended-ref>`; do not silently fall back to the checkout's production link | 2026-10-14 | `rollout-preflight.sql` |
| Hostinger deployment completes but every page returns HTTP 500 and missing `@swc/helpers` | pnpm 11 ignores `node-linker` in `.npmrc`, silently using isolated dependencies | Set `nodeLinker: hoisted` in `pnpm-workspace.yaml`; check effective config and actual hosted HTTP/sign-in after deployment (https://pnpm.io/settings) | 2026-10-14 | `pnpm-workspace.yaml` |
| Sandbox Stripe invoice webhook returns 500 after calculator lifecycle changes | Spreading the shared commission result sends live-only columns such as `billing_period_start` to `affiliate_sandbox_invoices` | Project only the sandbox table’s commission fields; test the real calculator-to-storage path for paid and refunded invoices | 2026-10-14 | `sandbox.test.cjs` |
| Coach finishes Stripe Connect but earnings still says payment setup is incomplete | The platform webhook destination did not receive the connected account's `account.updated` event | Reconcile only the signed-in coach's incomplete account from Stripe on the earnings read, persist the audited provider status, and stop polling once active | 2026-10-15 | `refreshCoachingConnectStatus` |
| A won Stripe dispute leaves an affiliate commission held at zero | `charge.disputed` records that a dispute occurred and can remain true after the dispute closes | Read the charge's dispute records; release on `won`, `prevented`, or `warning_closed`, and block open or lost statuses | 2026-10-16 | `affiliateDisputeBlocksCommission` |

### Staging Auth and coaching Checkout can hide untested paths

A new Supabase branch can have email auto-confirm enabled. Check the branch's public Auth
settings and attempt an unconfirmed sign-in before claiming confirmation-email coverage.
For this rehearsal, an explicit staging-only config changed `auth.email.enable_confirmations`
to true; all undeclared properties stayed unchanged. An accepted email-send request is not
proof that the recipient received or successfully used the link.

Coaching commerce accepts both full and restricted **test** Stripe credentials (`sk_test_`
and `rk_test_`). Reject live keys before provider writes. Its direct test-mode Checkout must
explicitly disable Managed Payments, just as the ordinary staging subscription checkout does;
otherwise sandbox account defaults can force an unintended merchant-of-record flow or require
product tax codes. Keep stored prices, session reuse, and idempotency keys intact.

### Unqualified privacy-cache deletion prevents consent in hosted Supabase

The consent/evidence/goal privacy trigger originally used `DELETE FROM coaching_scale_snapshots`
without a predicate. Hosted Data API transactions reject it with `DELETE requires a WHERE
clause`, rolling back consent itself. Migration `202610150002` uses the non-null primary key
as an explicit predicate, preserving full invalidation of organization and platform caches.
Do not disable the query guard or preserve stale aggregates to work around this. Verify the
actual authenticated consent RPC as well as `scripts/coaching/privacy-invalidation.sql` (rolled
back): the managed SQL connection does not permit loading `safeupdate`, so bare SQL tests
alone cannot establish Data API guard compatibility.

### Confirmation URLs must own the session used to finish enrollment

Supabase can return `error=access_denied&error_code=otp_expired` in the URL fragment after an
expired signup link. Handle provider URL errors before reading any existing browser session.
Signup/invite/recovery links missing verification details must fail visibly rather than reuse
an unrelated signed-in account. A background `TOKEN_REFRESHED` event can also carry that older
account while the link exchange is pending. The confirmation page now finishes only the
explicit exchange result; removing the competing auth listener also keeps exchange/enrollment
failures in the visible error handler. `scripts/auth-confirm.test.cjs` exercises these races,
missing/expired links, signup hashes, implicit tokens, and invite/recovery password setup.
