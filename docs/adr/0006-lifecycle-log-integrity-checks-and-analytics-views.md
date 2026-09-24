# ADR 0006 — Trigger-written lifecycle log, integrity checks, analytics views

**Status:** accepted · **Date:** 2026-09-23 · **Phase:** beta data capture

## Context

`CLAUDE_SPECS/DATA_CAPTURE.md` asks for a data layer where every ticket, buyer,
seller and transaction is queryable; where bad states are found by query rather
than by a user complaint; and which is analytics-ready for the organizer product
that comes later.

What existed:

- **Current state only.** `beta_ticket_units`, `beta_offers`, `beta_go_leads`
  and `beta_deals` carry good timestamps but no history. Once ops flips a
  status, the previous one is gone.
- **No actor on anything.** `payment_recorded_by` and `ticket_received_by` were
  the only two provenance columns in the beta schema; nothing else records who
  or what caused a change.
- **A behavioural log, not a state log.** `analytics_events` (0001) is
  fire-and-forget from the app — `lib/analytics/log.ts` swallows its own
  failures on purpose — with no before/after and no guarantee it was called.
- **`admin_actions`** (0003) audits the Phase 1 card-payment admin console,
  which the Interac beta doesn't use.
- Money is already `numeric(10,2)` everywhere, and there are no float columns —
  the one § structural-integrity requirement that was already met.

## Decision

Six migrations, `20260923090000`–`20260923090500`:

1. **`lifecycle_events`** — one append-only, semantically-named row per state
   change, with actor, source, correlation id, changed field names, and
   redacted before/after snapshots.
2. **Triggers** on `beta_ticket_units`, `beta_offers`, `beta_go_leads`,
   `beta_deals`, `beta_go_contacts`, `beta_member_interests`, `listings` and
   `transactions` — the only writers of that table.
3. **Write-path RPCs** for every transition that moves money or ticket
   ownership: claim, decline, buyer-declares-payment, ops-confirms-payment,
   forward-ticket, release-payout, seller-confirms-payout, ticket custody in,
   plus `record_manual_event` for off-app actions.
4. **`integrity_findings`** — a view of ~25 named bad states, snapshotted by
   `run_integrity_checks()` into `integrity_findings_log`, run nightly by
   `/api/v1/cron/integrity-check` and on demand from `/ops/data`.
5. **Ten analytics views** — ticket ledger, sales summary and daily revenue,
   demand vs supply, offer funnel, seller performance, buyer behaviour, sales
   velocity, platform daily, lifecycle timeline.
6. **Backfill** of history for rows that predate the triggers.

## Why these choices

**Triggers, not application logging.** The app is not the only writer: cron
sweeps, `allocate_offer`, ops SQL and future services all change ticket state.
A log the app maintains is a log with holes exactly where an incident happened.
The cost is that a trigger runs inside the user's transaction — so the emit path
is deliberately unfailable: event names are pattern-checked instead of
list-checked, unknown actor kinds and sources normalize to `system` /
`db_trigger`, and there are no foreign keys to violate. (An early version *did*
fail writes, because `lifecycle_actor_kind()` could return null into a NOT NULL
column. It was caught by seeding the harness, which is the argument for § 3.7 of
the brief in one sentence.)

**One semantic log rather than a generic change log plus a domain log.** A
generic `(table, row_id, old, new)` audit table answers "what changed" but makes
"how long from listed to sold" a jsonb archaeology exercise. Naming the event
(`buyer_payment_confirmed`, not `beta_offers updated`) while *also* carrying the
snapshots gets both, in one table with one set of indexes.

**No foreign keys from the log to its subjects.** `beta_ticket_units.sell_lead_id`
and `beta_offers.unit_id` cascade on delete, and `deleteQuickLead` /
`removeSellLead` are live code paths. An FK would mean deleting one lead erases
the history of every ticket under it. Subjects are `(subject_type, subject_id)`
with denormalized `unit_id` / `offer_id` / lead / contact columns, and DELETE is
logged with a final snapshot.

**Actor provenance via transaction-local GUCs, set inside the RPC.** Supabase
talks to Postgres through a pooler, so "call `set_actor_context`, then update"
from the app would land on two different connections. Setting the GUC with
`set_config(..., is_local => true)` in the body of the same function that does
the write puts the identity in the same transaction as the trigger that reads
it — and scopes it to that transaction, so it cannot leak into the next request.
Writes that arrive outside an RPC still log; they log as `system`, which is
honest.

**Redacted snapshots.** `SECURITY.md` § "never log sensitive data" and Law 25
minimization both point the same way, and a full row snapshot of
`beta_go_leads` would copy phone numbers, Interac addresses and ticket links
into a second table forever. Keys are kept with a `"[redacted]"` value, and
`changed_fields` is computed *before* redaction — so "their phone number changed
at 8pm" is answerable without the log holding a phone number.

**Locking on the money paths.** The RPCs `select … for update` and re-check the
guard after taking the lock. This was not theoretical: two ops operators
confirming the same payment in the same second previously both wrote, and two
allocation passes both raced the unique index. It also fixed a live bug — near
doors, `policy.ts` sends ops straight to "mark paid" on an offer that was never
accepted, and 0021's `beta_offers_payment_due_requires_accept` CHECK rejected
exactly that write. `confirm_offer_payment` now stamps `payment_due_at` when it
confirms payment on an unaccepted offer.

**Service-role only, for every new object.** Views in Postgres run with their
owner's rights, so a view over an RLS-protected table hands out everything the
owner can see; `security_invoker` would fix that but is Postgres 15+, and the
analytics surface has no per-user story anyway. So: RLS enabled with no
policies, **and** grants revoked from `anon` / `authenticated`. Both, because
this project has a default-privileges rule that grants new tables to those roles
automatically — the trap documented in 0009 — which is how the first version of
`lifecycle_events` ended up world-readable until a role test caught it.

**Where buyer/seller separation actually lives.** In the live beta, buyers and
sellers have no `auth.users` row: identity is a cookie holding a lead or contact
id, and the boundary is enforced in server code (`ownsLead`, `getGoActivity`)
behind the service-role client. RLS on the `beta_*` tables is default-deny with
no policies, which is a hard wall, not a per-user rule. The per-user RLS that
does exist — `transactions`, `listings`, `notifications`, `attendance` — is on
the card-payment path from Phase 1 and is unchanged (and re-tested: a user
unrelated to a transaction sees zero rows). Do not read "RLS is on" as "the
log enforces who may see whose ticket" — the ops console's own auth does.

**Plain views, not materialized.** The whole dataset is a few hundred rows.
`v_event_sales_daily` and `v_sales_velocity` are the two to materialize first
when a night starts producing tens of thousands of offers.

## What was rejected

- **Event sourcing as the source of truth** (rebuilding current state from the
  log). Too large a rewrite of a system with live money in it, and the existing
  tables already have the constraints that make bad states impossible.
- **Postgres `ENUM` for the new status-ish columns.** `DATA_CAPTURE.md` warns
  about them and the brief is right: `CHECK` on text is what the new tables use.
  The existing enums (`offer_status`, `ticket_unit_status`, `beta_deal_stage`)
  are left alone — converting them is a separate, riskier migration with no
  benefit today.
- **Exposing the analytics views to `authenticated`** for a future organizer
  dashboard. Organizers are not app users, the views carry cross-seller data,
  and owner-rights views would leak it. When that product is built it gets a
  scoped API, not a grant.
- **Swallowing trigger errors** (`exception when others then return null`). It
  would make the log best-effort, which is the property that made
  `analytics_events` insufficient in the first place. The emit path is made
  unfailable instead.
