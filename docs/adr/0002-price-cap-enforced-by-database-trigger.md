# ADR 0002 — The resale price cap is enforced by a database trigger

**Status:** accepted · **Date:** 2026-08-31 · **Phase:** 0/1

## Context

`CLAUDE_1.md` hard constraint 1: a listing may never exceed the ticket's original
face value unless an `EventAuthorization` row raises the ceiling.
`ARCHITECTURE.md` requires constraints "enforced at the database level, not just
in application code — the database should physically refuse".

A `CHECK` constraint cannot express this rule: it can only see the row being
written, and the cap lives in `events.original_price` and, when present,
`event_authorizations.max_resale_price`.

## Decision

Enforce the cap in three places, deliberately:

1. `src/lib/compliance/pricing.ts` — pure, unit-tested, the single definition of
   the rule in application code.
2. The server action / service layer, which re-validates regardless of what the
   client sent.
3. `enforce_resale_price_cap()`, a `BEFORE INSERT OR UPDATE` trigger on
   `listings` that re-derives the cap from the other two tables and raises
   `RESALE_PRICE_CAP_EXCEEDED`.

The client-side check in the sell form is convenience only and is never the
enforcement point.

## Why

The trigger is the only layer that holds if application code is bypassed — a
direct PostgREST call with a valid user token, a future admin script, a bug in a
new code path. `SECURITY.md` lists "a client-side-only check for anything
compliance-relevant" as a non-negotiable violation; three layers is the cheapest
way to make that structurally true rather than a convention.

## Consequences

- The rule is expressed twice, in TypeScript and in PL/pgSQL, and the two can
  drift. `src/lib/compliance/pricing.test.ts` covers the TypeScript side
  including the violation cases; an integration test that asserts the trigger
  rejects an over-cap insert should be added once a test database is wired up —
  tracked as follow-up work, not done here.
- `event_authorizations` has RLS enabled with zero policies, so no client role
  can read it. The trigger is `security definer` so it can.
