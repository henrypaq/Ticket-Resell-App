# ADR 0004 — Attendance visibility is an RLS policy, not a service filter; the magic-link sign-in path doesn't carry `next`

**Status:** accepted · **Date:** 2026-09-03 · **Phase:** 3

## Context

Two Phase 3 decisions have real tradeoffs worth recording.

**1. Where "see what events friends are attending" is enforced.** CLAUDE.md's
data model gives `AttendanceConfirmation` a `visibility` field with no
enumerated values. The done-when just says a user can "see what events
friends are attending" — it doesn't say whether that's a query-level filter
in a service function or a database-level access rule.

**2. Shared-link login redirect coverage.** The done-when also requires "a
shared listing link lands a new user directly on that listing." This app has
three first-party sign-in paths (email code, demo, Google OAuth) plus one
Supabase-templated path (clicking the magic-link email). Wiring a post-login
redirect through all four wasn't equally tractable in one session.

## Decisions

**Attendance visibility is enforced by the `attendance_read` RLS policy**
(migration `0008`), not by a `WHERE` clause chosen by whichever service
function happens to query the table. `domains/social/data.ts`'s
`listFriendsAttendingEvent` and `listUpcomingAttendance` both run as the
requesting user and simply ask for the rows that exist — the database decides
which ones that is.

**The `next` redirect (`requireSessionUser(nextPath)` → `/login?next=...` →
back to `nextPath` after auth) covers email-code, demo, and Google OAuth
sign-in. It does not cover clicking the magic-link email.** That path's
redirect target comes from Supabase's own email-template configuration
(`emailRedirectTo` on `signInWithOtp`), not from a URL this app fully
controls end to end.

## Why

- **RLS for attendance, same reasoning as ADR 0002's price cap:** a rule that
  matters for who-sees-what should be the thing that's true even if a future
  code path queries `attendance_confirmations` directly, forgets to filter,
  or a bug ships in a service function. Duplicating "only show followers'
  rows" in every call site is exactly the pattern `enforce_resale_price_cap`
  exists to avoid for pricing — this is the same shape of bug, for privacy
  instead of money. It also means the friends-going list and a followed
  profile's "going" list can't drift from each other, because they're not
  two independent filters that both have to be kept in sync — they're the
  same policy.
- **Skipping the magic-link path, deliberately, rather than guessing at
  Supabase's template behavior.** `emailRedirectTo` changes what
  `{{ .ConfirmationURL }}` resolves to in the *sent* email, and that
  template's exact behavior with an appended `next` query param isn't
  something this session could verify against a live send (SECURITY.md
  already flags this app's OTP flow as rate-limited — resending test emails to
  iterate on this wasn't a reasonable way to spend that budget). Shipping a
  guess that's wrong either silently drops `next` (no worse than today) or,
  worse, breaks the magic-link flow's redirect entirely. Three of four sign-in
  paths working correctly, with the fourth explicitly documented, is safer
  than four paths where one might be subtly broken.

## What was rejected

- **A service-layer visibility filter instead of RLS** — faster to write, but
  reintroduces exactly the "trust the caller to filter correctly" risk
  `SECURITY.md` and ADR 0002 both argue against for anything privacy- or
  compliance-relevant.
- **Guessing at `emailRedirectTo` + `next` behavior and shipping it
  unverified** — rejected per above; tracked instead as a known gap with the
  specific next step (verify the template, then wire `requestCode`).

## Consequences

- Any future attendance-visibility option (e.g. a real "public" tier, or a
  mute/block feature) is a policy change in one place, not a hunt through
  every function that reads `attendance_confirmations`.
- A new user who discovers this app via a shared listing link and signs in by
  tapping the magic-link email — rather than typing the 6-digit code, using
  the demo button, or using Google — lands on `/` instead of the listing.
  Tracked in README § known gaps with the concrete fix.
