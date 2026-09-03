# ADR 0001 — Supabase for Postgres, auth, and the typed data layer

**Status:** accepted · **Date:** 2026-08-31 · **Phase:** 0

## Context

`ARCHITECTURE.md` calls for Postgres behind a typed query layer and names Prisma
or Drizzle as examples. `CLAUDE_1.md` calls for email OTP / magic-link auth open
to any address. The credentials actually provisioned for this project are a
Supabase project URL, a publishable key, and a secret key — there is no direct
Postgres connection string available to the application runtime.

## Decision

Use Supabase as the Postgres host, the auth provider, and the data-access layer
via `supabase-js`. Schema changes live as checked-in SQL migrations under
`supabase/migrations/`.

## Why

- Both Prisma and Drizzle need a runtime `DATABASE_URL`. Adding one means
  distributing a database password to every environment that runs the app, which
  is a larger credential surface than the scoped keys we already have
  (`SECURITY.md` § least-privilege service credentials).
- Supabase Auth provides the OTP round-trip, per-email and per-IP send throttling,
  and httpOnly cookie sessions through `@supabase/ssr` — all of which
  `SECURITY.md` § authentication requires and none of which we'd want to
  hand-roll.
- Row Level Security gives us authorization enforced at the storage layer, not
  just in application code. That directly serves the "server-side enforcement,
  never client-side only" non-negotiable.
- `supabase gen types typescript` produces the typed query layer that
  `ARCHITECTURE.md` actually cares about; the ORM brand was an example, not the
  requirement.

## What was rejected

- **Prisma/Drizzle over a pooled connection string.** Better query ergonomics and
  a real migration runner, but it duplicates auth (we'd still use Supabase Auth),
  bypasses RLS unless carefully configured, and needs a credential we don't have.
  Worth revisiting in Phase 2 if escrow logic wants richer transactions than
  `supabase-js` exposes comfortably.
- **A separate Node API service.** Premature for a team this size; Next.js server
  actions plus a `/api/v1` surface cover both the web client and the Phase 5
  mobile client.

## Consequences

- Multi-step money operations in Phase 2 will need Postgres functions (RPC) to
  get real transactional guarantees, since `supabase-js` has no client-side
  transaction primitive. That is a known cost, deliberately accepted now and
  flagged for the escrow work.
- The service-role key must stay server-only. `src/lib/supabase/admin.ts` imports
  `server-only` so pulling it into a client component is a build error.
