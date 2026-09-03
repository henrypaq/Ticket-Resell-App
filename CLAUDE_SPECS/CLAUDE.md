# CLAUDE.md — Ticket Resale App (Customer-Facing)

This file is the build guide for the consumer-facing app. Read it in full before writing code — the compliance section constrains the data model and validation logic in every phase below, not just the pricing screen.

Data collection is deliberately handled in a companion file, `DATA_CAPTURE.md`, which should be read alongside this one starting in Phase 0 — instrumentation gets built in from the start, not bolted on later. Three more companions govern *how* everything below gets built: `SECURITY.md` (production security requirements — read before Phase 0, not before launch), `ARCHITECTURE.md` (engineering/code-quality standards — layering, testing, data integrity), and `STYLE.md` (visual design system — read it starting Phase 1, once there's UI to build). All five files together are the full spec; this one is the feature/phase roadmap specifically.

## What this project is

A mobile-first web app (installable PWA) to safely resell and acquire tickets to parties, club nights, and DJ events around Montreal, replacing the current process of texting group chats and hoping a screenshot is real. Open signup — any email address, no school/domain restriction. Secondary focus: light social features (friends, sharing, attendance) that give people a reason to open the app even when they're not actively buying or selling.

Full business/legal context and rationale live in the project's strategy doc. The load-bearing constraints from it are restated below as hard rules, because a future session picking up this file may not have that context.

## Hard constraints — do not violate, even in early prototypes

These come from Quebec's Bill 10 (ticket resale rules, in force September 12, 2026). They are enforced as validation logic, not copy on a page:

1. **Default resale price ceiling = the ticket's original face value.** A listing can never be created above that price unless it is explicitly linked to an `EventAuthorization` record created by an admin after a producer signed a written agreement (see Phase 4). There is no seller-side "set your own price" control in v1.
2. **No fee may be labeled or structured as a "transfer fee."** Any platform fee must be a clearly disclosed, itemized flat service fee, shown separately from the ticket price.
3. **Every listing discloses, before purchase:** original ticket price, event/seat details, that this is a resale (not primary) listing, and the itemized fee breakdown.
4. **Cancellations/changes propagate automatically:** producer → platform → every affected listing → every buyer/seller on it, "as soon as possible." This is an event-driven notification, not a manual process.
5. **Individual and repeat resellers are treated identically** under these rules — there is no lower-friction path for "just one person reselling one ticket."
6. **Out of scope for v1:** nightclub cover/door-entry resale and table/group-booking splitting. Only pre-sold, individually-issued event tickets (Eventbrite/Showpass/Tixr/university-system style) are in scope until the legal question on cover charges is resolved.

This section reflects non-lawyer research done ahead of the build. If it ever conflicts with actual legal advice the team receives, the legal advice wins — flag the conflict rather than silently resolving it in code.

## Tech direction

Optimize for: fast PWA delivery now, minimal rework moving to native app stores later, and a data layer already shaped for future B2B reporting (see `DATA_CAPTURE.md` — build to that spec from day one even though nothing external consumes it yet).

Suggested stack — adjust if there's a strong reason, but keep the app-store-transition path in mind before swapping frameworks:

- **Frontend:** React (Next.js or Vite), installable PWA — manifest.json, service worker (Workbox), mobile-first responsive layout. Keep UI components and business logic decoupled so a later React Native port (or a Capacitor wrap) can reuse the logic/API layer.
- **Backend:** Node/TypeScript API, Postgres. This data has real referential-integrity needs — listings, waitlists, transactions, and authorizations all reference each other and pricing validation depends on those relationships being correct.
- **Auth:** Email OTP / magic-link, open to any email address — no domain restriction, anyone can sign up. Verify the email is real and reachable via the OTP round-trip itself rather than gating on domain. Build this before any password-based flow; rely on the anti-fraud controls in `SECURITY.md` (rate limiting, anomaly detection, escrow, verification tiers) rather than a closed-signup gate to manage trust and fraud risk.
- **Payments:** Stripe Connect — marketplace split payments with escrow-style hold-and-release, Canada/Quebec-compatible. Build the "charge into platform balance, hold, then separately `Transfer`" mechanism starting in Phase 1, gated by a manual admin release rather than waiting for Phase 2's automated verification-triggered release — see Phase 1's Admin console and Phase 2.
- **Notifications:** Web Push via service worker for "a ticket matching your saved event was posted." iOS Safari's web-push support is weaker than native — note it as a known limitation, not a blocker for v1.
- **Ticket verification:** integrate the source platform's transfer API (Eventbrite, Showpass, Tixr) where available, before building the manual-verification fallback — see Phase 2.

## Phased build plan

Validate each phase's "done when" before starting the next. Don't push straight through multiple phases without a checkpoint — pricing, fees, and disclosure logic in particular should be reviewed before moving on, since they're the most legally exposed part of the app.

### Phase 0 — Foundations
**Goal:** a deployable skeleton with auth and the compliance-relevant data model in place; nothing user-facing yet beyond login.

- Project scaffolding, CI/deploy pipeline, installable-but-blank PWA shell.
- Email OTP/magic-link auth, open to any email address.
- Core schema stood up: `User`, `Event`, `EventAuthorization` (modeled but unused), `Listing`, `Transaction` (see schema sketch below).
- Analytics instrumentation wired per `DATA_CAPTURE.md` from the start, even if it just logs to Postgres for now.

**Done when:** a user can verify their email, sign up, log in, and install the app to a home screen.

### Phase 1 — Event bulletin + core listing/waitlist loop
**Goal:** the actual pain-point loop, end to end — post a ticket (including for an event that isn't on the platform yet), browse events, join a waitlist, get matched, and complete a real purchase with payment held until an admin manually reviews and releases it. Phase 2 later automates that release decision; Phase 1 ships the real underlying flow with a human in the loop instead of waiting on the automated verification engine.

- **Event sourcing — crowdsourced input, admin-gated approval.** Two different things, kept separate: who can make an event *discoverable* (browsable, shown in listings/search) versus who can make an event *resale-enabled* (a `Listing` can be created against it). Discoverability can be sourced loosely — admin entry, or a lightweight public import from partner platforms — since it carries no pricing/fraud risk on its own. Resale-enablement is the gate that matters, because `Listing.price` validates against `Event.original_price` (§ hard constraints) — if that number isn't trustworthy, the price cap is gameable. So:
  - Any user can **request an event** (surfaced right where a seller hits it: searching for their event in "Post a ticket" and not finding it). Preferred input is a link to the event's page on a supported source platform (Eventbrite/Showpass/Tixr). Pull `name`/`date`/`original_price` from that link automatically where possible — in practice this usually means parsing the public event page (most ticketing platforms embed structured price/event data — schema.org or Open Graph tags — in the page HTML) rather than an official read API; Eventbrite in particular shut down its general public Search API in 2020 and now scopes most of its API to an organizer's own events, so don't assume a clean documented endpoint exists per platform without checking. Fall back to a manual form (name, venue, date, price) with the link stored regardless, so there's always something for an admin to click through and verify by eye even when auto-parsing fails.
  - Every submitted or imported event — regardless of source — sits in `pending` status until an admin approves it and flips it to `resale_enabled`. No path skips this step in v1, including platform-imported events; auto-approval for API-verified Tier A platforms is a reasonable later optimization once submission volume actually requires it, not a v1 default.
  - This replaces pure "admin discovers and enters every event" with "admin approves what's submitted or imported" — same fraud/compliance gate, much less of a discovery bottleneck.
- **Post a ticket:** seller selects a `resale_enabled` event (or requests one per above if it's not there yet), attests they hold a valid ticket (manual attestation at this stage — the verification engine arrives in Phase 2), price auto-set to face value or below, listing goes live with every required disclosure rendered per § hard constraints.
- **Join waitlist:** for sold-out/high-demand events, buyers join a waitlist rather than seeing a raw listings feed; a simple feed is fine for events with open supply.
- **Match notification:** when a listing appears that matches a waitlist entry, notify that buyer.
- **Purchase + manual escrow (v1):** a buyer can actually complete a purchase, not just request one. Charge the buyer's payment into the platform's Stripe balance and hold it — don't transfer it to the seller yet. The listing/transaction sits in a held state until an admin reviews it from the admin console (below) and manually triggers either a `Transfer` to the seller or a refund to the buyer. This is a real, working payment flow, just with a person instead of Phase 2's automated verification signal deciding when to release.
- **Admin console (v1).** One interface, not three separate tools, covering everything an admin needs to run Phase 1 safely without the automation that arrives later:
  - **Event approval queue** — review `pending` events from § Event sourcing above (with `price_source` and `source_url` visible), approve to `resale_enabled` or reject.
  - **Listing moderation** — listings still go live immediately on posting (a pre-approval gate on every listing would kill the speed a resale marketplace needs, and there's no fraud-detection engine yet to run automatically anyway), but admins can view, flag, and remove any listing directly from the console — reactive moderation, not a blocking gate, until Phase 2 adds automated checks.
  - **Payment approval** — the release/refund queue for the manual escrow above: admin sees held transactions, whatever evidence exists (buyer/seller messages, listing details), and releases or refunds.
  - Every admin action here (approve/reject an event, remove a listing, release/refund a payment) is recorded — who, when, what — in an `AdminAction` log (see data model). This is both a `SECURITY.md` requirement (admin actions are audited, not just permitted) and how you'll actually resolve a dispute later.

**Done when:** a user can post a ticket (including requesting a new event for it if it's not listed yet), a different user can find it, join a waitlist, get matched, and complete a real purchase; an admin can approve/reject the event and listing side of that flow and manually release or refund the held payment from one console; and the whole flow respects every rule in § hard constraints.

### Phase 2 — Anti-fraud / verified ticket engine
**Goal:** replace "trust me" with actual verification — this is the single biggest lever on whether people trust the app enough to pay through it.

- Tiered verification:
  - **Tier A (preferred):** official transfer-API integration (Eventbrite/Showpass/Tixr). The old ticket is invalidated and a new QR is issued to the buyer through the source platform. Build this first for whichever platform your initial partner events actually use.
  - **Tier B (fallback):** manual verification — seller uploads the ticket, basic duplicate-detection (has this exact barcode/ticket ID been listed before?), and buyer protection leans on escrow rather than certainty of authenticity.
- **Automate the release trigger.** Phase 1 already does the real charge-into-platform-balance-then-`Transfer` mechanism, gated by a manual admin click. Phase 2 doesn't rebuild that — it replaces the trigger: release fires automatically off a verified signal (Tier A: API-confirmed transfer; Tier B: buyer confirms entry, with a timeout/dispute path) instead of waiting on an admin. Keep the manual release path from the admin console alive after this ships — it's the right fallback for disputes Tier A/B can't resolve cleanly on their own.
- Duplicate-listing detection across the platform.

**Done when:** a Tier-A event can be resold with the original ticket automatically invalidated and a verified new one issued, and a Tier-B event has a working escrow-plus-dispute flow.

### Phase 3 — Social layer
**Goal:** give people a reason to open the app beyond active buying/selling.

- Friend/follow system.
- Shareable listing/event links.
- Attendance confirmation ("I'm going") visible to friends.

**Done when:** a user can follow friends, see what events friends are attending, and a shared listing link lands a new user directly on that listing.

### Phase 4 — Compliance & admin tooling
**Goal:** operational tooling behind § hard constraints, so producer partnerships and disputes aren't run by hand in a spreadsheet indefinitely.

- Admin flow to create/manage `EventAuthorization` records — linking a producer's written consent to a max resale price for their event. This is the *only* mechanism that can unlock above-face pricing for a listing.
- Disclosure audit log: what exactly was shown to a buyer at time of purchase, kept for compliance record-keeping.
- Cancellation propagation: producer marks an event cancelled/changed → automatic notification cascade to every affected listing and user.
- Dispute/refund flow.

**Done when:** an admin can authorize a specific event for markup pricing, and the listing flow correctly — and only — unlocks above-face pricing for that event.

### Phase 5 — App-store transition prep
**Goal:** de-risk the eventual native submission without blocking on it now.

- Evaluate Capacitor (wraps the existing PWA fairly directly) against a React Native rebuild of the UI layer on the same backend/API — this is why Phase 0's UI/logic decoupling matters.
- Native push-notification parity check (this is where the PWA's iOS limitations actually get resolved).
- App Store / Play Store submission checklist — ticket resale apps draw extra review scrutiny, so budget real time for it, including required privacy labels.

**Done when:** there's a working native build in TestFlight/internal testing — not necessarily submitted yet.

## Data model sketch

Expand on implementation, but keep these relationships intact — they're what makes the pricing rules in § hard constraints enforceable rather than aspirational:

- `User` — id, email (verified), display_name, created_at
- `Event` — id, name, venue, date, source_platform (eventbrite/showpass/manual/etc.), source_url (nullable), original_price, price_source (platform_parsed / admin_verified / user_submitted_unverified / producer_confirmed — drives how much scrutiny an admin gives it before approval; see Phase 1), verification_tier (A/B), status (pending / discoverable / resale_enabled), submitted_by (nullable, user who requested it), approved_by (nullable, admin), approved_at (nullable). **Only `resale_enabled` events can have a `Listing` created against them — `pending`/`discoverable` alone is not enough.**
- `EventAuthorization` — id, event_id, producer_contact, agreement_reference, max_resale_price, authorized_at, authorized_by (admin user). **Its existence is the only thing that can unlock above-face pricing for that event.**
- `Listing` — id, event_id, seller_id, price (validated against `Event.original_price` or, if present, `EventAuthorization.max_resale_price`), status, disclosure_snapshot (exactly what was shown at listing time), created_at
- `WaitlistEntry` — id, event_id, user_id, created_at
- `Transaction` — id, listing_id, buyer_id, amount, fee_amount (itemized, never labeled "transfer fee"), escrow_status (e.g. held / released / refunded), verification_status, released_by (nullable, admin user — set when Phase 1's manual release path is used; null when Phase 2's automated release fires), completed_at
- `AdminAction` — id, admin_id, action_type (event_approved / event_rejected / listing_removed / payment_released / payment_refunded / etc.), target_type, target_id, notes (nullable), created_at. Generic audit log for everything done through the admin console (§ Phase 1) — extend `action_type` as new admin capabilities are added rather than adding a new log table per feature.
- `Follow` — follower_id, followee_id
- `AttendanceConfirmation` — user_id, event_id, visibility

## Non-goals for v1 — do not build these yet, even if they look easy

- Nightclub cover/door-entry resale and table/group-booking splitting (legal scope unresolved, and a genuinely different UX).
- Open, unmoderated *resale-enablement* — any user can request/import an event (§ Phase 1), but no event goes `resale_enabled` without admin approval, no exceptions in v1.
- Native app-store build (Phase 5 is prep, not submission).
- Any promoter-facing B2B dashboard or self-serve analytics product — that's a separate track. `DATA_CAPTURE.md` defines what to *capture* now; nothing here should be building a UI for promoters.
- Payment methods beyond cards via Stripe Connect — Interac e-Transfer support is a later evaluation, harder to escrow.
- Seller-set arbitrary pricing of any kind.
- Automated, verification-triggered payment release in Phase 1 — that's what Phase 2 adds. Phase 1's release is real money movement, but the trigger is a manual admin action, not an automated signal.

## Working conventions

- Treat § hard constraints as acceptance criteria, not background reading. A PR that lets a listing exceed face value without a valid `EventAuthorization` record is a bug, not a v2 feature.
- Build and demo one phase at a time; don't start Phase 2 work before Phase 1's "done when" is actually true.
- When a design decision touches pricing, fees, or disclosure, flag it explicitly rather than guessing — this is the part of the app most exposed to legal risk.
- Keep compliance-relevant logic (price validation, disclosure rendering, authorization checks) centralized and unit-tested, not scattered inline in UI components.
- **This file describes current intended state, not history.** When a decision changes, edit the relevant phase/data-model section in place so it reads correctly on its own — don't leave "previously X, now Y" narration inline. If the change affects a phase that's already been built, add an entry to the Revision log below instead; that's where history belongs.

## Revision log

Tracks changes made to this spec *after* a phase it affects may already be built. This is not a changelog of every edit — skip it for changes to phases that haven't been started yet, since there's nothing in the codebase to reconcile. Its job is to make sure a spec change to already-shipped code turns into an explicit task, not something that quietly falls out of sync.

When you open a Claude Code session to apply an entry here, say so directly — e.g. "Reconcile the codebase with the 2026-09-01 Event sourcing revision log entry" — rather than just "continue with CLAUDE.md," which reads as "move on to the next phase," not "go back and fix a completed one."

### 2026-09-01 — Event sourcing model (Phase 1)
**Changed:** event creation moved from purely admin-curated to user-request/import plus mandatory admin approval, with a new `discoverable` vs. `resale_enabled` status split (see Phase 1 and the `Event` schema above).
**Affects already-built code, if Phase 1 is already implemented:** a migration adding `Event.status`, `submitted_by`, `approved_by`, `approved_at`, `source_url`; a "request an event" UI + endpoint; an admin approval queue; and updating `Listing` creation to check `Event.status == resale_enabled` rather than just that the event exists.
**Reconciled in code:** ☑ 2026-09-01 — `supabase/migrations/0003_event_sourcing_and_admin.sql`; `/sell/request-event` (link autofill via `source-parser.ts` + manual fallback); `/admin/events` approval queue; `Listing` creation gated in `domains/listings/service.ts` and physically enforced by the `enforce_resale_enabled_event` trigger (verified live: an insert against a `pending`/`discoverable` event is rejected).

### 2026-09-01 — Manual escrow + admin console pulled into Phase 1
**Changed:** Phase 1 now includes a real purchase flow (not just request/match) with payment held via Stripe and manually released or refunded by an admin, plus a consolidated admin console covering event approval, listing moderation, and payment approval as one interface. Phase 2 no longer *introduces* escrow — it automates the release trigger that Phase 1's admin console handles manually. Added `Event.price_source`, `Transaction.released_by`, and the `AdminAction` audit-log entity to the data model.
**Affects already-built code, if Phase 1 is already implemented without a payment flow:** this is new functionality, not a tweak — Stripe Connect integration (charge-and-hold, per Tech direction above), the held/release/refund states on `Transaction`, the admin console's payment-approval view, and the `AdminAction` audit log all need to be added if they don't already exist. If listing creation and matching were built assuming no payment step, the "request/match" UI likely needs a purchase step added on top, not just a backend change.
**Reconciled in code:** ☑ 2026-09-01 — `domains/payments/service.ts` (`startPurchase`, charge-into-platform-balance via a plain PaymentIntent), `domains/admin/service.ts` (`releasePayment` / `refundPayment`, each a Transfer or Refund call plus an `AdminAction` row), `/admin` console (events/listings/payments), `admin_actions` audit log. The old reserve-only "request" step was removed and replaced by `CheckoutPanel`/`startPurchase` on the event page, so there's a single reservation+charge path rather than two. **Inert without Stripe keys** — every entry point checks `stripeConfigured()` and fails closed with a message rather than a crash or a faked result; see `README.md` § Stripe.
