# ARCHITECTURE.md — Engineering Guidelines

Companion to `CLAUDE.md`, `DATA_CAPTURE.md`, and `SECURITY.md`. This file is the "how to build it like it'll actually run in production" guide — code organization, data integrity, testing, and operational discipline. `CLAUDE.md` says what to build and in what order; this file says how to build each piece so it doesn't have to be rewritten once real users and real money are involved.

Apply these standards starting in Phase 0. Retrofitting architecture after Phase 2's payment/escrow logic exists is far more expensive than doing it right the first time.

## Guiding principles

- **Correctness on the money and compliance paths matters more than speed everywhere else.** Pricing validation, escrow, and `EventAuthorization` logic (see `CLAUDE.md` and `SECURITY.md`) deserve more rigor — more tests, more review, less cleverness — than, say, the friend-follow UI.
- **Boring and explicit beats clever.** This is a small team building something that has to keep working correctly with real money and real fraud pressure. Prefer well-understood patterns over novel abstractions.
- **Every layer should be testable in isolation.** If testing business logic requires spinning up the full HTTP stack, the layering is wrong.
- **Decisions with real tradeoffs get written down**, not just made silently in a PR — see § Architecture decision records.

## Layering

Keep a clear separation, even in a small codebase:

1. **Route/controller layer** — parses the request, calls a service, formats the response. No business logic here.
2. **Service/domain layer** — the actual business rules (price validation against `EventAuthorization`, escrow state transitions, waitlist matching). This is what unit tests target directly, without HTTP or database mocking gymnastics.
3. **Data access layer** — the ORM/query layer. Domain logic doesn't write raw queries inline; it calls a repository/data-access function.

Organize by domain, not by technical layer, at the top level — a `listings/`, `events/`, `payments/`, `users/`, `notifications/` structure (each with its own controller/service/data-access split inside) scales much better than a global `controllers/`, `services/`, `models/` split as the app grows, and it maps directly onto the entities in `CLAUDE.md`'s data model.

## Database & data integrity

- **Postgres via a typed query layer or ORM** (e.g., Prisma or Drizzle for a TypeScript stack) — raw SQL string-building is both a `SECURITY.md` violation and a maintainability problem.
- **All schema changes go through versioned migrations, checked into the repo.** No manual schema edits against any environment, ever — this is how staging and production silently diverge and migrations start failing.
- **Wrap multi-step money/state operations in database transactions.** Creating a `Transaction`, updating `Listing.status`, and adjusting escrow state must succeed or fail together — a partial write here is a real money bug, not a cosmetic one.
- **Foreign keys and constraints enforced at the database level**, not just in application code — the database should physically refuse to let a `Listing` reference a nonexistent `Event`, refuse a negative price, etc. Application-level validation is the first line of defense, not the only one.
- **Index deliberately**, based on actual query patterns (event lookups, user listings, waitlist matching), not preemptively on everything.

## API design

- **Consistent, predictable response and error shapes** across every endpoint — a client shouldn't have to special-case how errors look per route.
- **Version the API from the start** (even a simple `/v1/` prefix) — painless now, painful to retrofit once a mobile client (Phase 5) depends on it.
- **Validate every request body/query against an explicit schema** (ties to `SECURITY.md`) and return clear, structured validation errors rather than generic 500s.
- **Idempotency keys on any endpoint that mutates payment or escrow state** — required both for correctness (§ `SECURITY.md`) and for safe client-side retry behavior.

## Background work & async processing

- Several things in `CLAUDE.md` are inherently asynchronous and shouldn't block a request/response cycle: match notifications, cancellation-propagation cascades, webhook processing, analytics rollup computation. Use a real background job/queue mechanism (e.g., a Postgres-backed queue or a lightweight job runner) from the point these features are built, rather than firing off unawaited work inline in a request handler.
- **Webhook handlers (Stripe, ticketing-platform transfer callbacks) should be fast, verify-then-enqueue** — verify the signature, persist the event, return 200 quickly, and process the actual side effects asynchronously. Slow synchronous webhook handling causes retries and duplicate processing.
- **Retries use backoff and are idempotent** — a failed notification send or a flaky third-party API call (Eventbrite, Stripe) should retry safely without double-processing.

## Resilience & third-party integration

- **Treat every third-party integration (Stripe, Eventbrite/Showpass/Tixr transfer APIs, email/push providers) as something that will fail or time out**, and design for it: timeouts on all outbound calls, sensible fallback behavior (e.g., Tier A verification failing over to a manual/Tier B path rather than the whole listing flow breaking), and don't let one slow dependency take down unrelated features.
- **Don't build against undocumented or fragile scraping of a ticketing platform** — if a platform doesn't have a real transfer API, that event belongs in Tier B, not a brittle workaround.

## Testing strategy

- **Unit tests on the service/domain layer are the backbone**, especially for anything in `CLAUDE.md`'s "hard constraints" and `SECURITY.md`'s payment/escrow sections — price-cap enforcement, `EventAuthorization` gating, and escrow state transitions should have tests that explicitly try to violate the rule and confirm the system rejects it.
- **Integration tests** for the layer where the database and API actually connect — enough to catch wiring bugs unit tests can't see.
- **A small number of true end-to-end tests** for the critical user journeys (post a ticket → buyer finds and pays → escrow releases), not an attempt to E2E-test everything.
- **CI runs the full test suite on every PR and blocks merge on failure.** No merging with a known-broken test "to fix later."
- **New logic touching pricing, authorization, or payments should not merge without a test that exercises the failure case**, not just the happy path — this is where "someone tried to bypass the cap and the test proves they can't" lives.

## Code quality & tooling

- TypeScript in strict mode across frontend and backend, if using TypeScript.
- Linting and formatting enforced in CI, not just locally (ESLint/Prettier or equivalent) — style debates shouldn't happen in PR review.
- Pre-commit hooks for fast checks (lint, format, type-check) so obvious issues never reach CI.
- Meaningful PR review even on a small team — at minimum, a second set of eyes on anything touching § hard constraints, payments, or auth.

## Observability

- **Structured logging** (not `console.log` scattered around) with correlation/request IDs so a single request's path through the system can be traced.
- **Error tracking** wired in from Phase 0 (see `SECURITY.md`) — errors in production should surface to the team automatically, not be discovered from a user complaint.
- **Basic metrics/dashboards** on the things that matter operationally: listing creation rate, match rate, payment success/failure rate, verification tier A vs. B usage — this also happens to feed naturally into the `DATA_CAPTURE.md` rollups.

## Configuration & environments

- **Twelve-factor-style config:** all environment-specific values (API keys, database URLs, feature flags) come from environment variables/secrets, never hardcoded, never committed.
- **Dev, staging, and production are genuinely separate** — separate databases, separate Stripe keys (test vs. live), separate credentials, per `SECURITY.md`.
- **Feature flags for anything risky or partially rolled out** (e.g., turning on Tier A integration for a new ticketing platform) rather than shipping straight to 100% of traffic.

## CI/CD

- **Every merge to main is deployable** — tests, lint, type-check, and build all pass as a gate, not a suggestion.
- **Migrations are backward-compatible with the currently-deployed code** wherever possible (additive changes deployed before the code that depends on them), so deploys don't require risky simultaneous app-and-schema cutovers.
- **Staging mirrors production configuration** closely enough that "it worked in staging" is actually meaningful signal.

## Architecture decision records (ADRs)

For decisions with real tradeoffs — ORM choice, queue technology, Tier A vs. Tier B decision for a specific ticketing platform, Capacitor vs. React Native in Phase 5 — write a short ADR (a few paragraphs: context, decision, why, what was rejected and why) and keep it in the repo. This matters more than usual here because the compliance and security reasoning behind several choices (see `CLAUDE.md`, `SECURITY.md`) needs to survive team changes and not get silently "refactored away" by someone who wasn't there for the original reasoning.

## Definition of "production ready" — use this as an actual checklist, not aspirational language

Before any phase's features go in front of real users with real money:

- [ ] Server-side enforcement exists for every rule in `CLAUDE.md`'s hard constraints (not just client-side UI hiding).
- [ ] Payment/escrow operations are idempotent, transactional, and covered by tests that try to break them.
- [ ] `SECURITY.md`'s authentication, authorization, and input-validation baselines are met.
- [ ] Structured logging and error tracking are live for the feature.
- [ ] Migrations are reviewed and reversible.
- [ ] The feature has been through at least one real code review focused on the failure cases, not just the demo path.
