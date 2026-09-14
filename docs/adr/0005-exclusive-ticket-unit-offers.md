# ADR 0005 — Exclusive ticket-unit offers for the live beta waitlist

**Status:** accepted · **Date:** 2026-09-14 · **Phase:** beta matching

## Context

The live beta matched buyers to sellers by ops flipping `beta_go_leads.status`.
There was no join between a buy seat and a specific ticket, so two buyers could
both be marked "matched" to one sell listing. Near doors, silence, and unpaid
holds needed clocks and exclusivity — not another status enum.

## Decision

Model inventory as **ticket units** (`beta_ticket_units`: one row per sellable
ticket) and **exclusive offers** (`beta_offers`: at most one live hold per unit).

- Allocator walks the **real** unified queue (classic + `/go`), never the
  display fake-front padding.
- Response + payment clocks shorten near doors; inside ~2h of doors the mode
  becomes open (no exclusive hold).
- An exclusivity budget caps how long one unit stays exclusive before open/
  broadcast.
- Decline requeues immediately; no-response / unpaid expiry apply strikes and
  can dormant a seat until the buyer reactivates.
- Cron `reconcile-offers` materializes lazy expiry and advances units.
- Ops can force "release to open"; buyers claim at `/offer/[id]` with SMS/email
  soft-fail notifies.

## Why

- **One live claim per physical ticket** is the invariant ops status alone
  cannot enforce. A unique partial index on live offer statuses makes that
  true even if a future code path forgets to check.
- **Units separate inventory from the sell lead** so partial fills (sell 2,
  one buyer takes 1) and price-at-ask stay unambiguous.
- **Pure policy + RPC allocate** keeps clocks/eligibility testable without DB,
  while the insert path stays transactional.
- **Fake-front stays presentation-only** so marketing padding cannot steal
  rank-1 offers from real waiters.

## Consequences

- Existing sell leads need unit backfill (migration `0022` + ops button).
- E-transfer confirmation records amount/reference on the offer row until
  Stripe replaces that path.
- Open/broadcast UX for multi-buyer race is still ops-driven; product UI for
  open mode can come later.
