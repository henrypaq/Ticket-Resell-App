# mcgill.tickets — Technical Overview

**Read this to be able to explain the app to a technical interviewer.** It
describes the code **as it is today** (2026-09-18), including local work that
aligns the sell UX and event catalog with migrations 0021–0024 (units, exclusive
offers, Interac ops path). Not as the specs or the README describe Phase 0–3.

> ⚠️ **The root `README.md` is out of date.** It describes a Phase 0–3 product
> (Stripe escrow, event browsing, social graph, `/events/:id` pages). Most of
> that code still exists but is **no longer reachable** — `next.config.ts`
> redirects those routes away. What is actually live is the beta funnel
> documented below. § 13 gives you a clean live / inert / retired table so you
> never have to bluff on "is that running?"

---

## 1. What the product is

A mobile-first PWA for buying and selling tickets to Montreal club nights and
parties — Café Campus, Piknik Électronik, frosh nights, Bell Centre shows. It
replaces "post in a group chat and hope the screenshot is real."

The differentiator is not a listings feed. It's an **exclusive, rank-ordered
waitlist**: buyers join a queue for a night, sellers post tickets, and the
system hands each physical ticket to exactly one buyer at a time with a clock
on it. Nobody browses; nobody races; two buyers can't both e-transfer for the
same ticket.

**Business/legal frame:** Quebec's Bill 10 (in force 2026-09-12) caps resale at
face value and bans anything structured as a "transfer fee." Those aren't
copy on a page — they're validation logic and database triggers (§ 10).

**Current stage:** live beta, real users, hand-run by ops through an internal
console. Payments are Interac e-transfer through the platform, confirmed by a
human. Stripe is fully coded but switched off.

### The loop, end to end

```
Instagram story/bio  ─→  /buy   ─→  joins the queue (a "seat")
                     └─→  /sell  ─→  ticket becomes N "units" of inventory
                                        (confirmation screen + Interac email)

        allocator matches unit → next eligible seat
                                  ↓
          SMS + email: "a ticket is yours at $X, claim by 9:45"
                                  ↓
        /offer/<id>  →  Accept  →  Interac details + memo code MT-XXXXXXXX
                                  ↓
        buyer taps "I've sent the money"  →  payment-held screen
                                  ↓
        ops confirms transfer in /ops/offers  →  status = paid
                                  ↓
        seller transfers ticket  →  ops releases seller payout
                                        (Interac to seller's listing details)
```

---

## 2. The stack

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Framework | **Next.js App Router** | 16.3.4 | Server Components by default, Server Actions for all mutations |
| UI runtime | **React** | 19.2.8 | |
| Language | **TypeScript**, `strict: true` | 5.x | `@/*` path alias → `src/*` |
| Styling | **Tailwind CSS v4** | 4.x | via `@tailwindcss/postcss`; no `tailwind.config` file — v4 is CSS-first |
| Components | **Radix UI primitives** + local shadcn-style wrappers | — | `dialog`, `dropdown-menu`, `tabs` only; `src/components/ui/*` is ours |
| Icons | `lucide-react` | 1.45 | |
| Validation | **Zod** | 4.5 | every server action parses input through a schema |
| Database + Auth + Storage | **Supabase** (Postgres) | `supabase-js` 2.112, `@supabase/ssr` 0.12 | |
| Payments (live) | **Interac e-transfer**, ops-confirmed | — | platform is the intermediary |
| Payments (coded, off) | **Stripe** | 22.6 | charge-and-hold + `Transfer`; inert without keys |
| Email | **Resend** | REST | admin alerts, offer notifications, seller listing confirmation |
| SMS | **Twilio** | REST | offer notifications; credentials present |
| Bundler | **Turbopack** | (Next default) | workspace root pinned in `next.config.ts` |
| Tests | **Vitest** | 4.1 | 175 tests, 10 files, ~270 ms — node env, no DB |
| Lint | **ESLint 9** + `eslint-config-next` | — | `--max-warnings=0` in CI |
| Hosting | **Vercel** | Hobby | project `mcgilltickets`, domain `mcgilltickets.party` |
| CI | **GitHub Actions** | — | typecheck → lint → test → build on push/PR |
| Font | `Fraunces` via `next/font/google` | — | self-hosted at build; headlines only |

**Why this stack, if asked:** one deployable unit (no separate API server), one
language end to end, and Postgres as the place where the rules that must not
be violated actually live. Supabase gives Postgres + auth + object storage
without running infrastructure, and the escape hatch is plain SQL — the
migrations are hand-written SQL, not an ORM's generated output, precisely
because the load-bearing logic is triggers and partial indexes an ORM
abstraction would hide. (ADR 0001 records this decision and its cost.)

---

## 3. Runtime topology

```
Instagram / QR / flyer
        │  ?src=ig_story_cafe_0914
        ▼
   src/proxy.ts            ← Next 16 renamed "middleware" to "Proxy".
   (runs before routing)     Refreshes the Supabase session cookie and stamps
        │                    the two attribution cookies. Runs on every request
        │                    except static assets.
        ▼
   App Router route        ← Server Component. `export const dynamic = "force-dynamic"`
   (src/app/**/page.tsx)     on every user-facing page — all content is
        │                    per-visitor, nothing is cached.
        ▼
   Server Action / domain service
        │  (`"use server"` / `import "server-only"`)
        ▼
   Supabase Postgres  ──  triggers + partial unique indexes + RPCs
        │
        ├─→ Resend (email)      soft-fail
        ├─→ Twilio (SMS)        soft-fail
        └─→ Supabase Storage    private ticket-evidence bucket

   Vercel Cron (daily)  ─→  /api/v1/cron/*  (Bearer CRON_SECRET)
```

**Talking point — `proxy.ts`, not `middleware.ts`.** Next.js 16 renamed
Middleware to Proxy; the file convention is `src/proxy.ts` with a default
export. Functionality is identical. Ours does two things: refreshes the
short-lived Supabase access token so the browser never holds a long-lived one,
and writes the attribution cookies — which *has* to happen here, because
cookies cannot be set during a Server Component render (that 500'd the landing
page once).

**Talking point — why no caching.** Every page is `force-dynamic`. Queue
positions, offer clocks, and prices are all per-visitor and time-sensitive; a
stale price is a compliance problem, not just a UX one. The service worker
follows the same rule: it caches the app shell and flyer images and
deliberately refuses to cache anything else.

---

## 4. Code layout

```
src/
  app/                  route layer — parses input, calls a service, renders
    page.tsx            home (tonight's events + your activity)
    buy/ sell/ done/    the step flows
    offer/[id]/         the buyer's claim + pay screen
    settings/ upcoming/
    ops/                internal console (8 routes, password-gated)
    admin/              legacy Supabase-auth admin console (unreachable, see §13)
    api/v1/             versioned JSON surface: /health /events /listings
                        /cron/* (3), /webhooks/stripe, /admin/alerts/email
    auth/               Supabase OAuth callback + magic-link confirm
  components/
    app/                the live screens (home, buy-flow, sell-flow, done,
                        offer-claim-panel, settings, shell, header)
    beta-ops/           the ops console UI
    forms/ ui/          field primitives + Radix wrappers
  domains/              business logic, one dir per domain
    beta-quick/         buy & sell lead capture  ← the funnel
    beta-go/            the contact row leads hang off
    beta-signup/        optional saved profiles ("members")
    beta-queue/         the unified queue + fake-front padding
    beta-matching/      the offer engine: policy (pure) + service (I/O) + notify
    matching/doors.ts   when doors open, per event (pure)
    beta-ops/           ops console services + funnel analytics
    admin-alerts/       admin notification fan-out
    events/ listings/ payments/ social/ … ← legacy Phase 0–3 domains
  lib/
    beta-events.ts      the event catalog (in code, not a table) + Montreal
                        nightlife date math
    beta-acquisition.ts attribution channel parsing
    supabase/           client (browser) · server (RLS as user) · admin (service role)
    compliance/         price cap, fee model, disclosure — pure, unit-tested
    verification/       file-type sniffing, barcode hashing
    analytics/log.ts    append-only event log
    email/ twilio/ stripe/ env.ts
  _legacy/              retired routes, physically outside the route tree
supabase/migrations/    24 hand-written SQL migrations, applied in order
docs/adr/               5 architecture decision records
```

**The layering rule (from `ARCHITECTURE.md`):** routes parse and render;
domain services hold the rules; nothing in a route file makes a business
decision. The test for it: every rule that matters is unit-testable without
HTTP or a database, which is why `beta-matching/policy.ts` and `matching/doors.ts`
are pure functions taking `now` as an argument.

---

## 5. Identity without accounts

**There is no login wall.** An Instagram tap lands on the app and you can
complete a buy or sell in under a minute. This is the single biggest product
decision in the codebase and it drives a genuinely interesting identity model.

Three cookies describe one person:

| Cookie | Holds | Written when |
|---|---|---|
| `passe_go_contact` | a `beta_go_contacts` row id | you submit any buy or sell |
| `passe_quick_buyer` / `passe_quick_seller` | comma-joined lead UUIDs (last 20) | each submission |
| `passe_beta_signup` | a `beta_members` row id | you optionally save a profile |
| `passe_draft` | what you typed into a flow you abandoned | as you step forward |

All `httpOnly`, `sameSite=lax`, `secure` in production.

**The problem this creates:** a person on a second device, or one who cleared
cookies, is a different person as far as cookies are concerned — and the home
page would show them a listing it then refuses to let them delete.

**The solution — three independent proofs of ownership.** `ownsLead()` in
`domains/beta-quick/service.ts:207` accepts *any one* of:

1. the lead hangs off the contact id in your cookie, **or**
2. the lead id is in your buyer/seller cookie, **or**
3. the lead carries your member id.

Reads use the same disjunction (`getGoActivity` runs a PostgREST
`or(contact_id.eq.…,member_id.eq.…)`). Complementing that,
`adoptGoContactForMember` links a contact to a member the moment a device
carries both cookies — that's the person who used the quick flow before
signing up — and `linkMemberToGoHistory` re-runs when you edit your phone or
resume by email.

**If asked "isn't a cookie id insecure?"** — yes, it's a bearer capability, not
authentication. The honest answer: the blast radius is bounded to editing or
cancelling your own waitlist seat; nothing behind it moves money without an
ops human; and the alternative (a login wall) measurably kills the funnel this
product lives on. Ops actions and payouts sit behind a real signed session
(§ 8). It is a deliberate trade, and the upgrade path — promoting a member
cookie to a Supabase session — is already wired because the Supabase auth
plumbing is still in the codebase.

---

## 6. The core engine — queue, units, offers

This is the part worth 80% of the interview. Read `docs/adr/0005-exclusive-ticket-unit-offers.md`
alongside it.

### 6.1 The problem it solves

Before it, a "match" was just a status on a person's lead
(`beta_go_leads.status = 'matched'`). Nothing was consumed and there was no join
between a buy seat and a specific ticket — so **two buyers could both be told
about one ticket and both send an e-transfer for it.** That's a refund, a
trust failure, and a manual cleanup.

### 6.2 The three concepts

| Concept | Table | Meaning |
|---|---|---|
| **Seat** | `beta_go_leads` (buy) ∪ `beta_member_interests` | a person waiting, addressed by a `seat_key`: `go:<uuid>` or `classic:<uuid>` |
| **Unit** | `beta_ticket_units` | **one physical ticket.** A sell lead with quantity 3 becomes 3 units |
| **Offer** | `beta_offers` | one `(unit, seat)` allocation with a response clock and a payment clock |

Making the *unit* the thing that gets claimed is what makes "seller has 3, the
next three buyers take one each" fall out naturally instead of being a special
case. Partial fills work for free.

### 6.3 The unified queue

`domains/beta-queue/unified.ts` merges two sources into one chronological list
per event, sorted by `created_at` with the seat key as tiebreaker.
**Rank is `created_at`, forever** — being skipped, declining, or going dormant
never costs you your place. Only *eligibility* changes.

**Fake-front padding** (`beta-queue/padding.ts`): displayed positions are
offset by a per-event number (Café Campus 6, others 2) so an empty queue
doesn't read as dead. Critically, `rankOfSeat()` operates on the *real* seat
list only — marketing padding can never steal rank 1 from a real person. That
separation is deliberate and worth saying out loud.

### 6.4 The clocks — `domains/beta-matching/policy.ts`

Pure functions, no I/O, no clock of their own. Every entry point takes `now`.
34 unit tests.

```
MATCHING_DEFAULTS
  responseMs            45 min   offered → accept/decline
  paymentMs              2 h     accepted → paid
  shortResponseMs       15 min   both clocks, inside the short window
  shortWindowMs          6 h     to doors → short clocks
  openWindowMs           2 h     to doors → no exclusivity at all
  exclusivityMaxRanks    3       ranks tried before the unit opens up
  exclusivityBudgetMs   60 min   max wall-clock a unit stays off-market
  noResponseStrikesToDormant  2
  unpaidStrikesToDormant      1  ← accept-then-ghost is the expensive failure
```

**Three modes, chosen by distance to doors** (`matchingModeAt`):

- `exclusive` — full clocks, one holder at a time.
- `short_window` (≤6 h) — clocks compress to 15 minutes.
- `open` (≤2 h) — exclusivity is suspended entirely. `acceptOffer` refuses:
  *"Too close to doors — claim only when payment is confirmed."* First money
  wins, because parking a ticket on an unpaid promise an hour before doors
  means it doesn't get used at all.

Doors times come from `domains/matching/doors.ts`, which resolves an event's
**next** occurrence in Montreal local time. Note `montrealInstant()`: it
iterates to find the UTC instant for a local hour rather than hardcoding
−4/−5, because the offset depends on the instant you're computing. Handles DST
correctly; three passes, converges in two.

**The exclusivity budget** is the answer to "what if everyone ignores it?"
A unit can be offered to at most 3 ranks, or held off-market for at most 60
minutes total, whichever comes first. After that `nextAllocationAction`
returns `"open"` instead of `"next_rank"` and the ticket stops being hoarded
by the queue.

**Dormancy** is the answer to "what about the person who never replies?" Two
no-responses (or one accept-then-ghost) marks the seat dormant in
`beta_queue_seat_state`. A dormant seat **keeps its rank** but stops having
tickets held for it, until the buyer taps to reactivate — which stamps
`reactivated_at`, and strikes are only counted forward from that point. That's
what makes dormancy recoverable without deleting history.

### 6.5 The offer state machine

```
                    ┌──── live (occupies the unit) ────┐
  allocate  ──→  offered ──accept──→ accepted ──ops confirms──→ paid
                    │                   │                        │
                    │ 45 min            │ 2 h                    └→ payout_released_at
                    ↓                   ↓
          expired_no_response     expired_unpaid        needs_review (ambiguous payment)
                    │                   │
                    └──── decline ──────┴──→ declined / payment_failed / withdrawn
                                  (terminal — frees the unit)
```

`declined`, `expired_*`, `payment_failed` and `withdrawn` are terminal and
free the unit; the DB trigger `sync_unit_status_from_offer` flips
`beta_ticket_units.status` back to `available` automatically. A `withdrawn`
unit is **never** requeued — that's a refund path, not a reallocation.

### 6.6 The invariant, and why it lives in Postgres

```sql
create unique index beta_offers_one_live_per_unit
  on public.beta_offers (unit_id)
  where status in ('offered','accepted','paid','needs_review');
```

**At most one live offer per unit — enforced by the database, not by ops
discipline or application code.** However many times a sweep re-runs or ops
double-clicks, a second buyer physically cannot be allocated a claimed ticket.

There's a subtle consequence worth explaining, because it shows you understand
the tool: the predicate is a *static status list*, not `now() < expires_at`.
Postgres rejects non-immutable functions in a partial index. So an expired
offer is still "live" to the index even though it's dead to any reader. That
forces the allocator to **materialize** the expiry — write the terminal status
— before it can insert a successor.

Doing that in two round-trips over `supabase-js` leaves a window where a crash
strands the unit. So allocation is a Postgres function:

```sql
public.allocate_offer(...)
  1. SELECT … FOR UPDATE on the unit          -- serialize concurrent passes
  2. UPDATE expired offers → terminal status  -- materialize
  3. if a live offer still exists → return null
  4. if the unit isn't 'available'  → return null
  5. INSERT the new offer, return its id
```

One function, one statement, one transaction. Returning `null` is a normal
outcome ("someone took it first"), not an error — the allocator skips to the
next unit.

Everything the index *can't* express is a `BEFORE INSERT OR UPDATE` trigger,
`enforce_offer_guards`:

- the offer's event must match the unit's event, and the seat's event;
- **seat cap** — a seat may hold at most as many live offers as tickets it
  asked for (this is what lets a 2-ticket buyer get 2, while bounding how much
  supply one seat can hold hostage);
- **no self-dealing** — a contact can hold a buy *and* a sell lead for the same
  night, so the check matches the *person* behind the lead, not the lead id;
- only *becoming live* is gated — terminal transitions are always allowed, or
  a withdrawn unit could never have its dangling offer closed out.

### 6.7 Lazy expiry + a cron

Correctness never depends on the cron firing on time. Any read treats an
out-of-clock row as dead (`lazyExpiryStatus`), and `acceptOffer` materializes
the expiry itself if you tap a stale link. The cron
(`/api/v1/cron/reconcile-offers` → `reconcile_expired_offers` RPC →
`reconcileExpiredOffers`) exists only so the *next person in line gets told
promptly*. It's idempotent and safe to re-run.

**Constraint you should own rather than hide:** Vercel's Hobby plan only
allows **daily** crons. So `allocateAvailableUnitsForEvent` calls
`reconcileExpiredOffers` inline before every allocation, and `/ops/offers`
sweeps on page load. Correct, but it means requeue latency depends on traffic
rather than a timer. The fix is a paid plan or an external scheduler — it's a
billing decision, not an architecture one.

### 6.8 The allocation walk

`allocateNextForUnit` (`beta-matching/service.ts:263`):

```
load unit → available?
  ↓ compute doors → mode; if "open", skip (no exclusive hold near doors)
  ↓ sum exclusivity spend for this unit; if budget exhausted, skip
  ↓ walk the real queue oldest-first:
        loadSeatMeta  (quantity, price ceiling, dormancy, live offers, strikes)
        seatEligibleForOffer → dormant? seller? seat cap? price ceiling?
                               previously declined at ≥ this price?
        → first eligible seat wins
  ↓ allocate_offer RPC (atomic)
  ↓ log analytics · notify the buyer (SMS + email) · warm the next seat
    ("you're next if this falls through" — notification only, no offer row)
  ↓ mirror beta_go_leads.status = 'matched' for ops familiarity
    (the offer row is the source of truth; the lead status is a mirror)
```

**`maxPriceEach` is the nicest detail here.** A buyer can set "alert me at or
under $X." The allocator *skips* them rather than offering and waiting for a
decline — so a price-sensitive buyer never stalls the chain for everyone
behind them. And when someone declines for `reason = "price"`, the system
back-fills their ceiling to just under that price so it never offers them the
same thing twice.

---

## 7. The money path

**Today: Interac e-transfer, platform as intermediary, human-confirmed.**

1. Buyer accepts an offer → `/offer/<id>` shows the **platform's** Interac
   details (`PLATFORM_ETRANSFER_*` env — this is the single variable that can
   silently break the live money path: `platformEtransfer().configured` is
   false without `PLATFORM_ETRANSFER_EMAIL`, and the pay screen shows a
   configure message instead of payment details) plus a memo code,
   `paymentMemoForOffer()` → `MT-` + the first 8 hex chars of the offer UUID.
   Money goes to the platform, never directly to the seller — that's what makes
   hold-and-refund possible at all.
2. Buyer taps "I've sent the money" → stamps `buyer_declared_sent_at`
   (migration 0023). Deliberately does **not** change status: the buyer's claim
   isn't evidence, so exclusivity and the payment clock are unaffected.
3. Ops matches the incoming transfer by memo and marks it paid in
   `/ops/offers` → `status = 'paid'`, recording `payment_amount`,
   `payment_reference`, `payment_recorded_by` (migration 0022). The trigger
   flips the unit to `sold`; the seller gets "sold — transfer within 30 min."
4. Ops confirms the ticket reached the buyer and releases the seller payout →
   `ticket_transferred_at`, `payout_released_at` (migration 0024). When every
   unit on a sell lead is sold, the lead goes `done`.
5. `needs_review` exists for a partial or ambiguous payment — a human decides,
   and it counts as live so the unit stays held meanwhile.

**Fee model:** a flat **$2.49 CAD "Service fee"**, itemized separately from
the ticket price. `SERVICE_FEE_LABEL` in `lib/compliance/fees.ts` is the only
place that string is defined anywhere in the codebase, because Bill 10
prohibits a fee *labeled or structured* as a transfer fee.

**Stripe** (`domains/payments/`) implements the intended end state:
charge into the **platform's** balance with a plain `PaymentIntent` — not a
destination charge, not `transfer_data`, because either would settle straight
to the seller — then a separate `Transfer` on release, with `releaseCore()` as
the single place that call is made, shared by three triggers. It is complete
and typechecked, and **inert**: every entry point checks `stripeConfigured()`
first and fails closed with a readable message. No keys are set, and the route
is unreachable from the live UI.

*If asked why e-transfer:* zero onboarding friction for student sellers (no
Stripe Connect KYC), zero fees on a $20 ticket, and it's what this market
already uses. The cost is that settlement is manual and doesn't scale past a
few hundred transactions — which is exactly what the Stripe path is for, and
why it was built before it was needed.

---

## 8. The ops console (`/ops`)

Eight server-rendered routes where the business is actually run: overview,
waitlist, sellers, offers, members, links, analytics, login.

**Auth is separate from user auth, on purpose.** `domains/beta-ops/auth.ts`:

- an email allowlist (`BETA_OPS_EMAILS`) plus one shared password
  (`BETA_OPS_PASSWORD`);
- both compared with `crypto.timingSafeEqual` — including a same-length
  dummy compare when lengths differ, so length doesn't leak through timing;
- the session cookie is a `base64url(payload).HMAC-SHA256` token signed with
  `BETA_OPS_SECRET`, 30-day expiry, `httpOnly`;
- on decode it re-checks the email against the *current* allowlist — so
  removing someone from the env var kills their live session;
- `betaOpsConfigured()` fails closed: no secret set, no sessions at all.

**Where the guard actually sits — be precise about this.** There is no
`/ops/layout.tsx` guard and no `proxy.ts` matcher for `/ops`. Instead:

- **every page** calls `getBetaOpsSession()` and `redirect()`s in its own
  component body, and
- **every privileged server action** calls `requireBetaOpsSession()`
  independently — 18 of 18 in `beta-ops/actions.ts` (the two exceptions are
  login and logout, which must be open). So a POST straight at an action id
  does *not* bypass the page redirect.
- **Read services are the softer layer:** about half of `beta-ops/service.ts`'s
  read functions and all of `funnel-data.ts` have no guard of their own and
  rely on the page redirect above them. They're only imported by `/ops` pages,
  so it holds today — but it's convention, not enforcement, and a layout-level
  or proxy-level guard would be the honest fix.

What ops can do: see every lead grouped by event night, view signed 60-second
URLs for uploaded ticket evidence (the bucket is private), set fake-front
padding, mark offers paid / needs-review / payment-failed, release a unit to
open market, release seller payouts, generate campaign links, and read the
buy/sell funnel drop-off report.

---

## 9. Attribution and analytics

**Two cookies answering two different questions** — this is a genuinely good
detail to have ready.

| | `passe_beta_acq` | `passe_last_src` |
|---|---|---|
| Question | how did this person *originally* find us | which *link* produced this lead |
| Semantics | first-touch, **first write wins** | last-touch, every tagged visit overwrites |
| Shape | closed enum | free-form slug, ≤40 chars, shape-validated |
| Stored on | `beta_members.acquisition_channel` (CHECK-constrained, migration 0020) | `beta_go_leads.acquisition_channel` (plain text, no constraint) |

Last-touch exists because first-touch *can't* answer the story-link question:
a returning visitor's first-touch cookie was frozen months ago and would
swallow every campaign tag. And the tag is stored verbatim rather than routed
through `parseAcquisitionSrc`, which maps anything outside its enum to
`ig_bio` — that would silently relabel every new campaign as "Instagram bio."

The payoff: **a new story link needs no code change and no migration.**

```
https://mcgilltickets.party/buy?event=cafe-campus&src=ig_story_cafe_0914
```

One sharp edge, documented in the proxy: only paths in `ENTRY_PATHS` get
stamped. Add a landing path without adding it there and its traffic silently
records as `ig_bio`.

There's also fallback detection — Instagram's in-app browser identifies itself
in the user agent, so a bare bio tap with no `?src=` still attributes; anything
unrecognized records as `other` rather than being counted as a bio click it
might not be.

**One caveat on the funnel report** (`/ops/analytics`, `beta-ops/funnel.ts`):
`BUY_STEPS` is `event → quantity → contact → transfer → submit`, but the
`transfer` step only exists for Café Campus (it collects the ticket-transfer
recipient). For every other event that step never fires, so its drop-off row is
a phantom stage rather than a real abandonment. Know this before someone reads
the chart as a bug.

**Analytics** (`lib/analytics/log.ts`) is an append-only `analytics_events`
table with a **closed union type** of ~30 event names. Adding one means
deciding what question it answers first — Quebec's Law 25 data minimisation,
not a style preference. `logEvent` never throws; a failed insert is logged and
swallowed, because analytics is not allowed to break a user flow.

---

## 10. Compliance, and why enforcement is layered

Bill 10's caps are treated as acceptance criteria. The price cap is enforced
at **three independent layers**, and ADR 0002 exists specifically so nobody
later deletes one on the grounds that another covers it:

1. **Pure TypeScript** — `lib/compliance/pricing.ts`, unit-tested with
   explicit violation cases (13 tests).
2. **Service layer** — re-checked before any write.
3. **Postgres triggers** — `enforce_resale_price_cap` (legacy `listings`) and
   `enforce_unit_price_cap` (`beta_ticket_units`, migration 0021). The latter
   can't be a CHECK constraint because it must read another table, so it's a
   `BEFORE INSERT OR UPDATE` trigger that rejects `price_each > paid_each`
   (face value) and `price_each > ask_each`.

Layer 3 is the one that matters: it's the reason a hand-written SQL insert, an
ops edit, or a future code path that forgets to check still cannot produce an
over-cap ticket. Application validation is the first line of defense, not the
only one.

Also enforced structurally:

- `enforce_resale_enabled_event` — a listing can only exist against an
  admin-approved event.
- `follows_no_self_follow` — a CHECK constraint backing the app-level guard.
- `beta_offers_exactly_one_seat`, `beta_offers_response_window`,
  `beta_offers_payment_due_requires_accept` — the offer row can't be
  internally inconsistent.
- No seller-set pricing control exists in any UI or API. There is no
  per-seller pricing path at all, which is how "individuals and repeat
  resellers are treated identically" is satisfied — by absence.

**Be honest about this one if pressed:** in the current beta sell flow,
`paidEach` is mirrored from `askEach` (hidden field — single "Listing price"
step) because the flow doesn't ask separately what you paid. That value becomes
`beta_ticket_units.price_each` via `createUnitsFromSellLead` (`min(ask, paid)`).
So face value is a seller *attestation* with no independent source, and the cap
chain is structurally intact but only as trustworthy as that attestation. The
Phase 1 path — face value parsed from the event's source platform page — is
built (`domains/events/source-parser.ts`, schema.org / Open Graph) but isn't in
the beta funnel.

After submit, the sell lead is split into units, the allocator may fire an
exclusive offer immediately, and the seller sees an inline confirmation
(`SellConfirmation`) plus an email to their Interac address describing the
platform Interac path (buyer → us → seller).

---

## 11. Security posture

- **Three Supabase clients, three privilege levels.**
  `lib/supabase/client.ts` (browser, anon key) · `server.ts` (request-scoped,
  RLS applies *as that user*) · `admin.ts` (service role, **bypasses RLS**).
  The admin client and every domain service carry `import "server-only"`, which
  makes pulling one into a client component a **build error**, not a review
  catch.
- **Secrets.** `SUPABASE_PROJECT_KEY` is deliberately never aliased to
  `NEXT_PUBLIC_*`. All config goes through `lib/env.ts`, twelve-factor style —
  and every optional integration has a `…Configured()` predicate that fails
  closed rather than throwing (Stripe, Resend, Twilio, cron, ops, Interac).
- **RLS.** `beta_ticket_units`, `beta_offers`, `beta_queue_seat_state` have RLS
  **enabled with no anon/authenticated policies at all** — the only way in is
  the service-role client behind a server action. The `allocate_offer` and
  `reconcile_expired_offers` functions have EXECUTE revoked from
  `public, anon, authenticated`.
- **Input validation.** Every server action parses through a Zod schema with
  `superRefine` for cross-field rules (e.g. "phone *or* Instagram", "Interac
  email *or* phone", the Café Campus transfer fields).
- **File uploads.** Ticket screenshots are validated by **sniffing the actual
  magic bytes**, not the client-reported MIME type, then stored in a private
  bucket ops reads through short-lived signed URLs. Server Action body limit is
  raised to 9 MB specifically for these.
- **Cron endpoints** require `Authorization: Bearer $CRON_SECRET`, and **503
  when the secret isn't configured** rather than running unauthenticated.
- **Security headers** in `next.config.ts`: `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
  **CSP is deliberately absent** — shipping a policy now that gets loosened when
  the Stripe embed lands is worse than adding the real allow-list once.
- **Stripe webhook** is signature-verified and follows verify-then-enqueue,
  with a `stripe_events` table for idempotency.
- **Structured logging** — every warn path emits one-line JSON to stdout with a
  stable `msg` key. Nothing aggregates it yet (§ 14).

---

## 12. Data model

**Live beta tables**

| Table | Role |
|---|---|
| `beta_go_leads` | every buy and sell submission. `intent`, `event_slug`, `quantity`, `paid_each`/`ask_each`, contact + Interac fields, `max_price_each`, `contact_id`, `member_id`, `status`, `acquisition_channel` (last-touch) |
| `beta_go_contacts` | the thin person record leads hang off; optional `member_id` link |
| `beta_members` | saved profiles (was `beta_signups`; renamed in 0018) |
| `beta_member_interests` | the "classic" waitlist seat source, merged into the same queue |
| `beta_ticket_units` | one row per sellable ticket. Unique `(sell_lead_id, unit_index)` |
| `beta_offers` | one `(unit, seat)` allocation + both clocks + payment audit fields. `seat_key` is a **generated stored column** from whichever FK is set |
| `beta_queue_seat_state` | dormancy / reactivation, keyed by `seat_key` |
| `beta_queue_config` | per-event fake-front padding |
| `beta_member_event_requests` | "my event isn't listed" requests |
| `analytics_events` | append-only event log |

**Legacy Phase 0–3 tables** (still present, reachable only from retired code):
`profiles`, `events`, `event_authorizations`, `listings`, `waitlist_entries`,
`transactions`, `notifications`, `admin_actions`, `admin_allowlist`,
`stripe_events`, `follows`, `attendance_confirmations`, `organizers`,
`event_demand_summary`, `event_engagement_summary`.

**The event catalog is code, not a table.** `lib/beta-events.ts` holds four
events as a typed array with recurring `days` plus one-off `extraDateKeys`.
Café Campus is Tue–Sat every week; frosh / Niska / Piknik have empty `days`
until you add nightlife dates under `extraDateKeys` — nothing auto-recycles a
one-off onto next week. Deliberate: hand-curated venues during beta, schedule
reviewable in a diff. The `events` table still exists for the general
resale-enabled flow.

**The Montreal nightlife calendar** is its own small piece of domain logic
worth mentioning: a night runs until **6 AM**, so at 2 AM Sunday, Saturday's
event is still "tonight." All date math goes through `Intl.DateTimeFormat` with
`timeZone: "America/Toronto"` so Vercel's UTC runtime doesn't shift a night.
11 unit tests cover it.

---

## 13. Live / inert / retired — the honesty table

Have this ready. The codebase is bigger than the running product.

**Specifically what's wrong in `README.md`**, if you'd rather fix it than
pre-empt the question: § Social layer, § Tiered verification, and § Event
sourcing all describe retired screens in the present tense; the migration list
stops at `0008` when there are 24; the escrow cron is described as *hourly*
when `vercel.json` says daily; and the two newer crons (`reconcile-offers`,
`release-stale-reservations`) and the whole units/offers engine aren't
mentioned at all.

| Area | Status | Detail |
|---|---|---|
| `/`, `/buy`, `/sell`, `/done`, `/settings`, `/upcoming`, `/offer/[id]` | ✅ **live** | the beta funnel |
| `/ops/*` (8 routes) | ✅ **live** | how the business is run |
| Queue → units → offers engine | ✅ **live** | §6 |
| Interac payment path | ✅ **live** | ops-confirmed |
| Resend email | ✅ **live** | `RESEND_API_KEY` set |
| Twilio SMS | ✅ **live locally** | all four required vars set. Quirk worth knowing: `twilioConfigured()` requires `ADMIN_SMS_TO` — an *admin-alert* variable — so clearing it silently disables **buyer** offer SMS too. `sendSms()` returns `{skipped:true}` rather than throwing when unconfigured, so the failure is silent by design |
| `/qr/*`, `/seller-terms`, `/sms-opt-in` | ✅ **live** | print/QR assets; `/sms-opt-in` is Twilio verification evidence |
| Supabase Postgres + Storage | ✅ **live** | |
| PWA (manifest + service worker) | ✅ **live** | installable; shell-only caching |
| Stripe escrow + `/api/v1/webhooks/stripe` | 🟡 **coded, no keys** | fails closed via `stripeConfigured()` |
| `/api/v1/cron/*` (3 routes) | 🟡 **coded, needs `CRON_SECRET`** | **not set in `.env.local`, so inert locally — production is unverified from the repo** (Vercel env vars live in the dashboard, not the file). Check `vercel env ls` before claiming either way. `reconcile-offers` is compensated by the inline sweep regardless |
| Supabase user auth (`/login`, OAuth, magic link) | 🟡 **built, not in the funnel** | the beta app has no login wall; Google provider not enabled on the project |
| `/admin/*` (Supabase-auth console) | 🟡 **built, superseded** | `/ops` is what's used |
| Tier A verification providers | 🟡 **fail-closed interface** | no partner API access exists; ADR 0003 |
| `/events/:id`, `/u/:handle`, `/tickets`, `/search`, `/profile`, `/home`, `/notifications` | ❌ **retired** | 307-redirected in `next.config.ts`; code lives in `src/_legacy/` |
| Social layer (follows, attendance, share links) | ❌ **unreachable** | tables + services exist; no live route renders them |
| `src/domains/matching/policy.ts` (665 lines, 98 tests) | ❌ **unwired** | a parallel implementation superseded by `beta-matching/policy.ts`; only its own test imports it. Its sibling `doors.ts` **is** live |

Also worth knowing: `package.json` still says `"name": "scaffold-tmp"`. The
product is mcgill.tickets / Passe.

---

## 14. Testing, CI, deploy

**175 tests across 10 files, ~270 ms, no database.** That speed is the point —
every rule that matters was written as a pure function specifically so it
could be exhaustively tested without infrastructure.

| File | Covers |
|---|---|
| `beta-matching/policy.test.ts` (34) | clocks, modes, eligibility, budget, dormancy, next-action |
| `matching/doors.test.ts` (18) | doors resolution incl. DST boundaries |
| `compliance/pricing.test.ts` (13) | price cap **including explicit violation cases** |
| `lib/beta-events.test.ts` (11) | nightlife date math, the 6 AM rule |
| `verification/ticket-evidence.test.ts` (9) | magic-byte file sniffing |
| `lib/beta-acquisition.test.ts` (8) | attribution parsing |
| `matching/policy.test.ts` (98) | the **unwired** parallel policy module — see §13 |
| + ops funnel, waitlist partition, stripe money | |

**CI** (`.github/workflows/ci.yml`): `npm ci` → `tsc --noEmit` → `eslint src
--max-warnings=0` → `npm test` → `next build`, on Node 24, with placeholder env
values (no live credentials in CI).

**Deploy:** Vercel, push-to-`main`. Migrations are **not** applied
automatically — 24 numbered SQL files, applied in order via `supabase db push`
or the dashboard SQL editor. Verified after, not assumed: migration 0007's
storage policies touch `storage.objects`, owned by `supabase_storage_admin`,
and a plain `psql` connection silently lacks the privilege. That's a lesson
this repo learned the hard way and wrote down.

**ADRs** in `docs/adr/` — Supabase as the data layer (0001), price cap in a
trigger (0002), Tier A fail-closed + auto-release (0003), attendance
visibility in RLS (0004), exclusive ticket-unit offers (0005).

---

## 15. Interview crib sheet

**"Walk me through the architecture."**
Next.js App Router on Vercel, Supabase Postgres. One deployable unit — Server
Components render, Server Actions mutate, domain services hold the rules, and
the rules that must never be violated are additionally enforced by Postgres
triggers and partial unique indexes. Three privilege levels of database client,
separated by `server-only` imports so misuse is a build error.

**"What's the hardest technical problem here?"**
Making sure one physical ticket goes to exactly one buyer, under concurrency,
with clocks running, while people ghost. Answer in three parts: model the
*ticket* not the *listing* as the claimable thing; enforce one-live-offer-per-
unit with a partial unique index so no code path can violate it; and do
expire-then-insert inside a single Postgres function with `SELECT … FOR
UPDATE`, because two round-trips over an HTTP client isn't a transaction.

**"Why is business logic in the database?"**
Because a price cap that only lives in TypeScript is a cap until someone adds a
second write path. Three layers, deliberately redundant, documented in ADR
0002 so a future engineer doesn't "clean up" the duplication.

**"How do you handle users who don't sign up?"**
There's no login wall at all — that's the funnel. Identity is a cookie-bound
contact row with three independent ownership proofs, so a second device or a
cleared cookie doesn't orphan someone's history. It's a bearer capability, not
authentication, with a bounded blast radius; anything touching money is behind
a real signed session.

**"What would you do with more time / money?"**
Paid Vercel plan for sub-daily crons; Stripe Connect to replace manual Interac
settlement; a real job queue instead of unawaited `void` fan-out; error
tracking (Sentry); and integration tests against the triggers, which needs a
disposable test database.

**"What are you least happy with?"**
The README drifted from the code during the pivot to the beta funnel, and
there's a 665-line unwired parallel matching module with 98 passing tests that
should be deleted. Both are the same failure: nothing forces dead code and
stale docs to be reconciled.

---

## 16. Known gaps — say these before they're found

- **No integration tests against the database layer.** Triggers and RLS are
  verified manually; the unit tests stop at the TypeScript boundary. Needs a
  disposable test database.
- **No error tracking.** Structured JSON to stdout; nothing aggregates it.
- **No job queue.** Notifications fan out inline as unawaited promises with
  failures isolated so they can't break the user's flow — fine at current
  volume, not a design.
- **Daily crons only** (Vercel Hobby), compensated by inline sweeps. §6.7.
- **Face value is self-attested** in the beta sell flow. §10.
- **Cookie identity is a bearer capability.** §5.
- **No CSP** until the payment embed is known. §11.
- **`/ops` read services lean on the page-level redirect** rather than each
  guarding themselves. Mutations are all guarded. §8.
- **Dead code:** `src/_legacy/`, the unreachable social/admin/Stripe surface,
  and `domains/matching/policy.ts`.
- **README is stale** — this document supersedes it for current state.
