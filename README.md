# Passe — Montreal ticket resale (Phase 0 + Phase 1 + Phase 2 + Phase 3)

Mobile-first PWA for reselling and picking up tickets to parties and club nights
around Montreal. Built against the specs in `CLAUDE_SPECS/` — `CLAUDE.md` is
the phase roadmap, with `SECURITY.md`, `ARCHITECTURE.md`, `DATA_CAPTURE.md`, and
`STYLE.md` governing how each piece gets built.

## Status

**Phase 0 and Phase 1 are implemented, including the 2026-09-01 revision log
entries** (event sourcing with admin approval, and manual escrow + admin
console — see `CLAUDE_SPECS/CLAUDE.md` § Revision log).

**Phase 2 is implemented for Tier B; Tier A is a fail-closed interface, not a
real integration** — see § Tiered verification below and
[ADR 0003](docs/adr/0003-phase2-tier-a-fail-closed-and-auto-release-cron.md).

**Phase 3 (social layer) is implemented** — follow/unfollow, "I'm going"
attendance confirmation visible to followers, and shareable listing links —
see § Social layer below. Connect onboarding (Phase 4) is not started.

Payments are wired end to end but **inert without Stripe keys** — see
§ Stripe below. The auto-release timeout is similarly **inert without
`CRON_SECRET`** — see § Tiered verification.

## Getting started

```bash
npm install
npm run dev -- -p 3005     # http://localhost:3005
npm test                   # compliance unit tests
```

### Environment

`.env.local` holds the Supabase credentials. The app reads:

| variable | used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server |
| `SUPABASE_PROJECT_KEY` | **server only** — service role, bypasses RLS |
| `ENABLE_DEMO_LOGIN` | **server only** — set to `true` to show the demo sign-in button |
| `DEMO_LOGIN_EMAIL` | account the demo button signs into (default `demo@passe.local`) |
| `CRON_SECRET` | **server only** — authorizes the Tier B auto-release cron endpoint; see § Tiered verification |
| `RESEND_API_KEY` | **server only** — Resend API key for admin waitlist/sell alert emails |
| `RESEND_FROM_EMAIL` | **server only** — optional From header (default `mcgill.tickets alerts <onboarding@resend.dev>`) |
| `ADMIN_ALERT_EMAIL` | **server only** — comma-separated admin inboxes (default `wrymage@gmail.com`) |
| `BETA_OPS_EMAILS` | **server only** — comma-separated emails allowed into `/ops` |
| `BETA_OPS_PASSWORD` | **server only** — shared password for `/ops` (never commit) |
| `BETA_OPS_SECRET` | **server only** — HMAC secret for ops session cookies |

The `NEXT_PUBLIC_*` pair aliases the original `SUPABASE_PROJECT_URL` /
`SUPABASE_PUBLISHABLE_KEY` values; Next.js only exposes prefixed variables to
client code. `SUPABASE_PROJECT_KEY` is deliberately not aliased.

### Database

Migrations are checked in under `supabase/migrations/` and are **not applied
automatically**. Apply them once, in order:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_seed_events.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_event_sourcing_and_admin.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0004_event_detail_content.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0005_seed_event_details.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0006_seed_past_event.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0007_phase2_verification.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0008_social_layer.sql
```

Or, if the project is linked via the Supabase CLI (`supabase link`), `supabase db push`
applies every pending migration in order and is what this repo's own sessions
now use — verify afterward with
`supabase db query --linked "select policyname from pg_policies where tablename = '...'"`
rather than assuming a push succeeded silently (0007's storage policies taught
that lesson — see below).

`0003` adds the event-sourcing status split, the manual-escrow columns on
`transactions`, and the `admin_actions` / `admin_allowlist` / `stripe_events`
tables — see § Admin console and § Stripe below. `0007` adds Tier B ticket
evidence on `listings` (barcode hash + optional photo, with a partial unique
index enforcing duplicate detection), the dispute/buyer-confirmation columns on
`transactions`, and a private `ticket-evidence` storage bucket — see §
Tiered verification. `0008` adds `follows` and `attendance_confirmations` —
see § Social layer.

`0007`'s storage RLS policies touch `storage.objects`, which is owned by
`supabase_storage_admin` — applying it through the dashboard's SQL editor (as
above) has the right privileges; a plain `psql` connection might not. After
applying, confirm both policies exist:
`select policyname from pg_policies where tablename = 'objects';` should list
`ticket_evidence_read_own` and `ticket_evidence_read_admin`.

The connection string is in the Supabase dashboard under
**Project Settings → Database → Connection string (URI)**. Alternatively, paste
each file into the dashboard's SQL editor.

Until `0001` is applied, `/login` works but every authenticated screen will error —
the tables don't exist yet.

### Signing in

Three routes onto the platform:

1. **Email code** — enter an address, get a 6-digit code (see the template note
   below). Open to any address, no domain restriction.
2. **Continue with Google** — wired end to end, but the provider is not yet
   enabled on the Supabase project. Create a Google OAuth client, add its ID and
   secret under **Authentication → Providers → Google**, and add
   `https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect
   URI in Google Cloud. No code change is needed; the button starts working. Until
   then it returns a message saying so rather than dead-ending on a Supabase 400.
3. **Demo account** — one tap, no email round-trip. Development only.

#### The demo button

`ENABLE_DEMO_LOGIN=true` in `.env.local` renders a "Enter the demo account"
button on `/login`. It mints a single-use magic-link token with the service role
and redeems it through the normal `verifyOtp` path, so the session, cookies, and
RLS behave exactly as they do for a real user — the only thing skipped is the
email delivery.

The flag is read **server-side only** (`demoLoginEnabled()` in `src/lib/env.ts`).
It gates both whether the button renders and whether the action will do anything,
so hiding the button is never what enforces it. It is hard-disabled when
`NODE_ENV === "production"`. Verified in both states: with the flag unset the
button does not render *and* the action returns "Demo sign-in is disabled."

**Leave `ENABLE_DEMO_LOGIN` unset in any deployed environment.**

#### Demo social data

`scripts/seed-demo-social.mjs` seeds the demo account with a small social
graph — four fake friend accounts, follows, a spread of "I'm going"
confirmations, and one purchased + one listed ticket — so the home feed's
"What your friends are into" / "Who I follow" and the Tickets page have
something real to show instead of an empty state. Run it once after the
demo account exists (`node scripts/seed-demo-social.mjs`, needs
`SUPABASE_PROJECT_KEY` in `.env.local`); it's idempotent, safe to re-run.

This only ever touches rows reachable from the demo account (as the
follower/buyer, or the fake friend accounts it creates) — it doesn't hook
into the real signup path at all, so a real account always starts with a
genuinely empty social graph. Verified directly: a fresh, non-demo account
signed in through the real magic-link flow sees neither section on the home
page, and `/profile` shows "Following (0)".

### Admin console

Two email addresses are seeded as admins in `0003_event_sourcing_and_admin.sql`
(`admin_allowlist` table): `henrypaquin0@gmail.com` and
`edvardroberts@gmail.com`. Admin status attaches automatically the first time
that address signs in — `handle_new_user()` checks the allowlist at
profile-creation time. To add another admin, insert a row into
`admin_allowlist` (their account can already exist; a follow-up trigger only
fires on *new* signups, so backfill an existing profile manually if needed).

The console lives at `/admin` — three tabs (Events, Listings, Payments) plus an
overview. `requireAdmin()` gates every route and every server action
independently; a non-admin gets a 404 (not a 403, so the console's existence
isn't advertised). Verified both directions: a non-admin session gets 404 on
`/admin` and every admin action; the two seeded emails get `is_admin = true` on
first sign-in and reach all three tabs.

Every admin action — approve/reject an event, flag/remove a listing,
release/refund a payment — writes an `admin_actions` row (who, when, what) and
is never triggerable from a client without going through that same guard.

### Stripe

Payments are fully wired — `startPurchase` (buyer checkout → charge into the
platform's balance, held) and the admin console's release/refund — but every
entry point checks `stripeConfigured()` first and fails closed with a readable
message when keys are absent, rather than crashing or faking a result. Add real
test-mode keys to `.env.local` (see the comment block there) and everything
becomes live with no code change:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

For local webhook testing: `stripe listen --forward-to localhost:3005/api/v1/webhooks/stripe`.

**The mechanism, deliberately:** a buyer's payment is charged into the
*platform's* Stripe balance via a plain `PaymentIntent` and held there — not a
destination charge, not `transfer_data`, because either of those would settle
straight to the seller. The actual `Transfer` call lives in one place —
`domains/payments/release.ts#releaseCore` — shared by three triggers: an
admin's "Release" action, a buyer confirming entry, and the Tier B auto-release
timeout. See § Tiered verification.

**Payout accounts are out of scope for Phase 1.** There is no Connect
onboarding flow. `profiles.stripe_account_id` exists as a column; until a
seller has one, "Release" reports that explicitly rather than failing
silently or guessing an account.

### Auth email template

Login uses email OTP. To get a 6-digit code (rather than only a magic link), the
Supabase email template under **Authentication → Email Templates → Magic Link**
needs `{{ .Token }}` in the body. Both paths are supported: the code form on
`/login`, and the link, which lands on `/auth/confirm`. Note that Supabase's free
tier throttles auth emails aggressively — a "rate limit exceeded" error during
testing is that limit, not a bug in the app.

## Event sourcing

Any signed-in user can request an event from `/sell/request-event` — paste a
link (Eventbrite/Showpass/Tixr/etc.) for best-effort autofill via
`src/domains/events/source-parser.ts` (schema.org / Open Graph parsing, since
most platforms don't expose a public read API), or fill the form by hand. Every
submission lands in `pending`. **No path skips admin approval** — verified live
against the database: a direct SQL insert of a `listings` row against a
`pending` or `discoverable` event is rejected by the `enforce_resale_enabled_event`
trigger, the same way an over-cap price is rejected by
`enforce_resale_price_cap`.

`discoverable` vs `resale_enabled` is a real split: a `discoverable` event shows
up in the feed but still can't be listed against. Only `resale_enabled` unlocks
`Listing` creation, in the sell form, the API, and the database.

## Tiered verification (Phase 2)

**Barcode evidence requirement, precisely:** `domains/listings/service.ts` gates
on whether the event's source platform has a *configured* Tier A provider
(`getTierAProvider(...).configured()`), not on the `verification_tier` label —
since no provider has real credentials yet (see below), this is currently
every event regardless of its tier, and self-corrects the day a real Tier A
integration ships for one platform.

**Tier B** (every seeded event today — `verification_tier` defaults to `B`):
posting a ticket now requires a barcode/ticket-ID, entered by hand or scanned
with the device camera (`src/components/barcode-scanner.tsx`, using the
browser's native `BarcodeDetector` — no new dependency, and it quietly does
nothing on Safari/iOS since that API isn't implemented there, leaving manual
entry as the fallback). The barcode is hashed (`src/lib/verification/ticket-evidence.ts`,
never stored raw) and checked against every other live listing before the new
one is allowed to go live — blocked both in `domains/listings/service.ts` and,
as the layer that actually can't be bypassed, a partial unique index in
migration `0007`. A photo/PDF of the ticket is optional supporting evidence,
validated server-side by sniffing its actual bytes (not the client-reported
MIME type) and stored in a private Supabase Storage bucket only the seller and
admins can read.

**Tier A** (Eventbrite/Showpass/Tixr/DICE-sourced events, once any exist) has
no real transfer-API integration — there's no partner API access yet.
`src/lib/verification/tier-a-providers.ts` is a fail-closed interface: every
platform reports "not integrated" and Tier A events fall back to Phase 1's
manual admin release, exactly as before. See
[ADR 0003](docs/adr/0003-phase2-tier-a-fail-closed-and-auto-release-cron.md).

**The automated release trigger (Tier B only).** A held payment now releases
to the seller three ways, all through the same `releaseCore()`:

1. **Admin release**, from the console — unchanged from Phase 1.
2. **Buyer confirms entry** — a "Did you get in okay?" prompt appears on
   `/tickets` once the event has passed and the payment is still held. One tap
   releases the payment immediately.
3. **Auto-release timeout** — if the buyer does neither, a hard-coded 24 hours
   after the event ends (`coalesce(events.doors_close_at, events.starts_at)`),
   an hourly Vercel Cron job (`vercel.json` → `/api/v1/cron/release-escrow`)
   releases it automatically. **Inert without `CRON_SECRET`** set in the
   environment — the endpoint 503s rather than running unauthenticated, the
   same fail-closed shape as Stripe. Locally: `curl -H "Authorization: Bearer
   $CRON_SECRET" localhost:3005/api/v1/cron/release-escrow`.

A buyer can report a problem instead of confirming — this moves the
transaction to `escrow_status = 'disputed'` (visible on `/tickets` and in the
admin Payments tab), which only an admin can resolve, by releasing or
refunding from the same console actions used for a plain held payment.

## Social layer (Phase 3)

**Follow** is one-directional, no request/approval step — matches the data
model sketch (`Follow.follower_id`, `Follow.followee_id`) exactly, and is what
"friends" means everywhere else in this phase. Follow/unfollow from a public
profile at `/u/<handle>` (`FollowButton` — `domains/social/service.ts`) or from
the **Friends** section on `/profile`, which also has a handle search box
(`searchProfilesByHandle`) since there's no other way to find someone to
follow yet. `follows` is world-readable to any authenticated user (same
openness as `profiles`); only the follower can write their own row, and a
`follows_no_self_follow` check constraint backs up the app-level guard the
same way `enforce_resale_price_cap` backs up the price-cap check — not just
trusted client-side.

**Attendance confirmation** ("I'm going," `AttendanceToggle` on the event
page) always writes `visibility = 'followers'` — the only value the UI
offers. That's enforced by RLS, not application code: `attendance_read` in
migration `0008` lets a viewer see their own rows always, and someone else's
only when `visibility = 'followers'` **and** the viewer follows that user —
so "see what events friends are attending" (the Phase 3 done-when) is a
property of the database policy, not a filter a service function could get
wrong. The event page's "X going" row and a profile's "going to" list
(`listUpcomingAttendance`) both just run as the viewer and let RLS decide
what comes back.

**Shareable listing links.** Each listing card on an event page has its own
`Share` button building `/events/<id>?listing=<listingId>&ref=share#listing-<listingId>`
— the query param drives server-side highlighting (a ring around that one
card) and the `share_link_opened` analytics event; the `#listing-*` fragment
gets the browser to scroll straight to it natively, no client JS required.
Landing a **signed-out** visitor directly on that listing (the done-when's
actual hard part) needed a fix to the login flow, not just the event page:
`requireSessionUser()` now takes an optional `nextPath`, and every sign-in
path (email code, demo, Google OAuth) threads a `next` param through and
redirects there after auth instead of hardcoding `/`. The one sign-in path
this does **not** cover is clicking the emailed magic-link — its redirect
target comes from Supabase's own email template configuration
(`emailRedirectTo`), and changing that without being able to test the actual
template behavior risked breaking the already-rate-limit-sensitive magic-link
flow; a new user who signs in by typing the 6-digit code, using the demo
button, or using Google all land back on the exact listing, but a new user who
clicks the magic-link email lands on `/` instead. Tracked below.

## How the hard constraints are enforced

`CLAUDE.md`'s § hard constraints are treated as acceptance criteria. Where each
one lives:

| constraint | enforcement |
|---|---|
| Resale price ≤ face value unless an `EventAuthorization` exists | `src/lib/compliance/pricing.ts` (unit tested, including violation cases), re-checked in `domains/listings/service.ts`, and physically enforced by the `enforce_resale_price_cap` trigger — see [ADR 0002](docs/adr/0002-price-cap-enforced-by-database-trigger.md) |
| No fee labeled or structured as a "transfer fee" | `src/lib/compliance/fees.ts` — flat itemised service fee, one definition of the label, asserted by test |
| Full pre-purchase disclosure | `src/lib/compliance/disclosure.ts` builds the payload once; it is both rendered by `DisclosurePanel` and frozen into `listings.disclosure_snapshot` so the two can't drift |
| No seller-set arbitrary pricing | The sell form has a hard cap; there is no override control anywhere in the UI or API |
| Individual and repeat resellers treated identically | There is no per-seller pricing path at all |
| A listing can only exist against an admin-approved event | `enforce_resale_enabled_event` trigger on `listings`, re-checked in `domains/listings/service.ts` before that |

## Architecture

```
src/
  app/            route + page layer (parses, calls a service, renders)
    (app)/        authenticated shell — For You, Upcoming, Tickets, Search, event detail, sell, profile, u/[handle]
    auth/         confirm (email magic link) · callback (OAuth code exchange, now next-aware)
    admin/        event approval, listing moderation, payment approval — all behind requireAdmin()
    api/v1/       versioned surface over the same services, for the Phase 5 mobile client
                  GET /events · GET|POST /listings · GET /health
                  POST /webhooks/stripe (signature-verified, verify-then-enqueue)
                  GET /cron/release-escrow (CRON_SECRET-guarded, Vercel Cron)
  domains/        business logic, organised by domain
    events/ listings/ waitlist/ notifications/ users/ payments/ admin/ social/
  lib/
    compliance/   price cap, fees, disclosure — pure and unit tested
    verification/ Tier A provider interface (fail-closed) + Tier B barcode hashing/file validation
    supabase/     client (browser) / server (RLS as the user) / admin (service role)
    analytics/    append-only event log
    next-path.ts  validates a post-login redirect target (same-origin only)
supabase/migrations/   versioned SQL
docs/adr/              architecture decision records
vercel.json            Vercel Cron schedule for the auto-release sweep
```

## Analytics

`DATA_CAPTURE.md`'s taxonomy is wired from day one into `analytics_events`
(append-only). Live in Phase 1: `signup_completed`, `login`, `event_page_view`,
`listing_created`, `listing_viewed`, `waitlist_joined`, `waitlist_left`,
`search_no_results`, `purchase_initiated`. Live in Phase 2:
`verification_tier_b_used`, `duplicate_listing_flagged`, `purchase_completed`
(now fired for every release trigger, tagged by `release_trigger` in its
metadata), `purchase_disputed`. Live in Phase 3: `friend_added`,
`attendance_confirmed`, `share_link_created` (now optionally carries a
`listing_ref_id` for a listing-scoped share), `share_link_opened` (same).
Rollup tables (`event_demand_summary`, `event_engagement_summary`) exist but
are deliberately unpopulated — no dashboard ships from this phase.

## Known gaps in this phase

- **A shared listing link doesn't survive the magic-link sign-in path.**
  Email code, demo, and Google OAuth sign-in all preserve `?next=` and land a
  new signed-out visitor back on the exact listing they clicked through on
  (§ Social layer). Clicking the magic-link email doesn't yet — its redirect
  target is controlled by Supabase's email template config
  (`emailRedirectTo`), and wiring `next` through it wasn't done without being
  able to verify the actual template behavior against a live send. Fix:
  confirm the template's `{{ .ConfirmationURL }}` behavior with `next`
  appended, then thread it through `requestCode`.
- **No follow-request/approval step, no notification on a new follower, and
  no bottom-nav "Friends" tab.** All deliberately out of Phase 3's
  done-when — `Follow` in the data model sketch is exactly `follower_id,
  followee_id`, nothing else.
- **No integration test against the new RLS policies either** (`follows`,
  `attendance_confirmations`) — same gap as the price-cap/resale-enabled
  triggers below, waiting on the same disposable test database.
- **Web Push is deferred.** Match notifications write a `notifications` row and
  surface in-app. `CLAUDE.md` flags iOS Safari's web-push support as weak; the
  `notifications` table is the delivery-agnostic seam for adding push later.
- **Filter chips on Upcoming are presentational.** Rendered as non-interactive,
  not fake buttons — filtering isn't useful against a hand-curated list this size.
- **No integration test against either trigger.** Both the price-cap and the
  resale-enabled gate are unit tested at the TypeScript layer and were verified
  manually against the live database this session (see ADR 0002 and § Event
  sourcing above); an automated integration test needs a disposable test
  database, which isn't wired up yet.
- **Tier A has no real transfer-API integration** — no partner API access
  exists yet for Eventbrite/Showpass/Tixr/DICE. It's a fail-closed interface
  that falls back to Phase 1's manual admin release; see § Tiered verification
  and [ADR 0003](docs/adr/0003-phase2-tier-a-fail-closed-and-auto-release-cron.md).
  Connect onboarding is also still not built — same as Phase 1.
- **No malware scanning on the optional ticket-photo upload.** `SECURITY.md`
  asks for it; this phase only validates file type (by magic bytes, not the
  client-reported MIME type) and a size cap.
- **The auto-release sweep isn't atomic per transaction.** Its handful of
  sequential writes (transaction, listing, notification) aren't wrapped in one
  Postgres transaction — the same known cost ADR 0001 already flagged for
  multi-step money operations over `supabase-js`. Safe to re-run (idempotent
  per transaction), so a mid-sweep crash self-heals on the next hourly run
  rather than double-releasing.
- **Phase 2's UI (barcode scan/entry, evidence upload, the buyer
  confirm/dispute prompt, the admin dispute view) was built and typechecked
  but not exercised in a running browser this session** — no Supabase project
  was connected to click through the actual flows. Load-test it before
  treating it as verified, the same way this repo's own conventions ask for UI
  changes elsewhere.
- **No integration test against the new partial unique index either** — the
  Tier B duplicate-barcode check is unit tested at the hashing layer and
  checked in application code before insert; an integration test against the
  live index needs the same disposable test database the price-cap/resale-gate
  triggers are waiting on (see above).
- **CI workflow exists but has never run.** `.github/workflows/ci.yml` runs
  typecheck, lint, tests, and build on push/PR — added in this session, not yet
  exercised by an actual push to a remote.
- **The demo login button is a deliberate development shortcut.** It must be
  removed, or its flag left unset, before anything is deployed. It is
  double-gated (env flag + `NODE_ENV`) but it is still an auth bypass by design.
- **Google OAuth is wired but not enabled.** The provider needs credentials added
  to the Supabase project before the button does anything — see § signing in.
- **No error tracking.** `SECURITY.md` wants Sentry-style reporting from Phase 0.
  Logging is structured JSON to stdout; nothing aggregates it.
- **No background job queue.** `ARCHITECTURE.md` wants match notifications off
  the request path. Phase 1 fans out inline (a handful of waitlist rows) with the
  failure isolated so it can't fail the listing; this needs a real queue before
  cancellation-propagation cascades in Phase 4.
