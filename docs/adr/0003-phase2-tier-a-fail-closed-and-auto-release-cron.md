# ADR 0003 — Tier A ships fail-closed; the Tier B auto-release timeout is a Vercel Cron sweep

**Status:** accepted · **Date:** 2026-09-03 · **Phase:** 2

## Context

`CLAUDE.md` § Phase 2 asks for two things that don't have an obvious default
implementation in this codebase:

1. **Tier A verification** — "official transfer-API integration
   (Eventbrite/Showpass/Tixr). The old ticket is invalidated and a new QR is
   issued to the buyer through the source platform." That requires an
   organizer-scoped partnership and real API credentials with one of these
   platforms. None exist yet — confirmed with the team before starting this
   work, rather than assumed. `CLAUDE.md` itself already flags that Eventbrite
   shut down its general public Search API in 2020, so "a documented endpoint
   exists" can't be assumed for any of them without checking a live
   partnership's actual docs.
2. **The automated release trigger for Tier B** — "buyer confirms entry, with a
   timeout/dispute path" instead of an admin manually releasing every payment.
   The timeout half needs *something* to fire it on a schedule, and
   `ARCHITECTURE.md` § background work explicitly wants "a real background
   job/queue mechanism... rather than firing off unawaited work inline in a
   request handler" — and this repo has no job queue yet (a README-documented
   known gap since Phase 1).

## Decision

**Tier A ships as a fail-closed provider interface**
(`src/lib/verification/tier-a-providers.ts`), not a real integration. Every
platform's `configured()` returns `false` and `transferTicket()` returns
`{ ok: false, code: "not_integrated" }`. This is the same shape as
`stripeConfigured()` / `PAYMENTS_UNCONFIGURED` in `lib/env.ts` and
`domains/payments/service.ts` — Phase 1's precedent for "the mechanism is
real, the credentials aren't, so it fails closed with a readable message"
rather than crashing or faking a result. Tier A events keep working exactly as
they did in Phase 1: manual admin release from the console is the only release
path, because there is no automated signal to trigger anything else.

**The Tier B auto-release timeout is a Vercel Cron job** hitting
`/api/v1/cron/release-escrow` on an hourly schedule (`vercel.json`), guarded by
a `CRON_SECRET` bearer token the same way Stripe keys gate payments — unset the
secret and the endpoint 503s rather than running unauthenticated. The route
calls `domains/payments/auto-release.ts#releaseExpiredEscrows()`, which sweeps
every held Tier B transaction (deliberately including one where the buyer
already confirmed but the Transfer itself hasn't succeeded yet — e.g. no
seller payout account — since that row must stay retryable, not just an
admin-only recovery) and releases the ones whose event ended more than 24
hours ago (`coalesce(events.doors_close_at, events.starts_at) + 24h`),
funnelling through the same `releaseCore()` used by admin release and buyer
confirmation (`domains/payments/release.ts`). A per-row failure — thrown or
returned — is caught and recorded so one bad transaction never stalls the rest
of the sweep, and the whole sweep no-ops (rather than throwing) if Stripe
isn't configured, matching every other release entry point's fail-closed
behavior.

## Why

- **Tier A:** writing speculative HTTP calls against undocumented or
  unverified partner APIs would look integrated while doing nothing, or break
  the first time it actually ran against a real account. An honest stub that
  degrades to Phase 1's already-working manual release is strictly safer, and
  the interface means a real implementation later is additive — nothing else
  in `domains/payments` needs to change; `releaseCore`/the admin console
  already treat "no automated signal" as the normal case.
- **Cron over a request-time timer:** a per-transaction timer needs a durable
  scheduler this repo doesn't have. A periodic idempotent sweep is the
  simplest mechanism that's still a *real* scheduled job rather than
  fire-and-forget work fired off inside a request handler — it satisfies
  `ARCHITECTURE.md`'s spirit without standing up a queue technology this
  project doesn't otherwise need yet.
- **The clock anchors on the event, not the purchase:** a buyer physically
  cannot confirm entry to an event that hasn't happened. Anchoring on
  `doors_close_at`/`starts_at` makes it structurally impossible for the sweep
  to release before the event occurs, regardless of when the sweep happens to
  run.
- **Only Tier B is swept:** Tier A has no verification signal to time out on
  yet (see above) — sweeping it too would silently turn "no signal" into "release
  anyway after a day," which is a materially different trust guarantee than
  what Phase 2 promises for Tier A.

## What was rejected

- **A real Tier A integration against one "best guess" platform.** Rejected
  because it can't be tested against a real account, and the spec's own done-when
  ("the old ticket is automatically invalidated and a verified new one issued")
  can't be honestly claimed without one.
- **A per-transaction scheduled job via a queue/RPC.** More precise than a
  sweep, but it's new infrastructure this project doesn't have yet for a
  feature (Phase 2 timeout) that a sweep on an hourly cadence already satisfies
  ("as soon as possible" isn't promised anywhere for this specific timeout —
  the buyer-confirmation path is the fast one).

## Consequences

- Real Tier A support is future work: pick a first platform once a partnership
  exists, implement that one provider's `configured()`/`transferTicket()`
  against real, verified API docs, and leave the others as fail-closed stubs.
  Nothing else needs to change.
- The auto-release sweep does several sequential `supabase-js` writes per
  transaction (transaction update, listing update, notification insert) rather
  than one Postgres transaction — the same non-atomicity ADR 0001 already
  flagged as a known cost of not having RPC-backed multi-step writes. A crash
  mid-sweep could leave a transaction released without its listing marked
  `sold`; the sweep is safe to re-run (idempotent per-transaction via
  `escrow_status` and the Stripe idempotency key), so a stuck row self-heals on
  the next hourly run rather than duplicating a Transfer.
- Vercel Cron's minimum interval depends on plan tier — confirm the configured
  hourly schedule is actually honored on whichever plan this deploys to, and
  adjust `vercel.json` if not.
- No malware scanning on the optional Tier B ticket-photo upload
  (`SECURITY.md` asks for it) — only type/size validation by magic bytes. See
  README § known gaps.
