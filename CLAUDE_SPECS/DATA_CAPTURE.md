# DATA_CAPTURE.md — Analytics & Demand-Data Layer

Companion to `CLAUDE.md`. This file governs what the app captures about usage and events, and how it's structured — not a promoter-facing product. No dashboard or external report ships from this file; it exists so that when the B2B analytics track eventually starts (see the project strategy doc), the data already exists in a usable shape instead of needing to be retrofitted.

Build to this spec starting in Phase 0 of `CLAUDE.md`. Retrofitting event tracking after the fact means losing all the historical data from before it existed — capture from day one even though nothing consumes most of it yet.

## Privacy framing — read before writing any tracking code

This app collects personal data from Quebec residents, which puts it under **Quebec's Law 25** (private-sector personal information protection). This is engineering-relevant, not just a legal footnote, because it shapes what the schema and access patterns have to look like:

- **Consent is purpose-specific.** Consent to use a verified account identity to run the marketplace is not automatically consent to share derived data with event promoters. These need to be tracked as separate consent flags, and the "share aggregate data with organizers" consent should be its own opt-in, with clear plain-language copy, not buried in a general terms-of-service checkbox.
- **A Privacy Impact Assessment (PIA) is expected before any data-sharing arrangement with a third party (a promoter) goes live** — even in aggregate form. This is an org-level task the team needs to actually do, not something code can satisfy on its own; flag it as a checklist item before Phase where any B2B sharing is built, not something to skip because "it's just aggregate numbers."
- **A privacy officer must be designated** for the organization (can be a named team member by default) — also an org task, not a code task, but worth noting here since it's a real legal requirement, not optional process theater.
- **Data minimization:** don't add a tracked field "because it might be useful later" — every field in the event taxonomy below should map to a specific, statable use. If you add a new event type during implementation, ask what it's for before adding it.
- **Retention:** define a retention window per data category (see table below) rather than keeping everything forever by default.
- **Anonymization/aggregation before third-party exposure:** any data that could eventually reach a promoter must go through an aggregation layer (see § Aggregation rules) that strips individual identity — this is a hard requirement, not a nice-to-have, and should be architected in from the start so it's not a rushed retrofit later.

None of this blocks building the marketplace itself — it specifically constrains the *sharing* path, which isn't being built yet per `CLAUDE.md`'s non-goals. But the schema below is designed so that constraint is easy to satisfy later rather than requiring a rebuild.

## Architecture: append-only event log + rollup views

Two layers, not one:

1. **Raw event log (`AnalyticsEvent` table)** — append-only, one row per user action, full fidelity, never shown to anyone outside the team directly. This is the source of truth.
2. **Aggregated rollup tables**, computed from the raw log on a schedule (nightly is fine at this scale) or on demand — these are what any future reporting/dashboard layer queries. Rollups are where anonymization and minimum-count thresholds are enforced, so a dashboard built later never has to touch raw per-user data directly.

This two-layer split is the single most important design decision in this file: it means the eventual B2B product is "build a UI on top of rollup tables that already exist," not "figure out how to safely extract and anonymize a year of raw logs under deadline pressure."

### `AnalyticsEvent` schema

| field | type | notes |
|---|---|---|
| id | uuid | |
| event_type | text | see taxonomy below |
| user_id | uuid, nullable | null for anonymous/pre-auth events if any exist |
| event_ref_id | uuid, nullable | related `Event.id`, if applicable |
| listing_ref_id | uuid, nullable | related `Listing.id`, if applicable |
| metadata | jsonb | event-specific extra fields (see taxonomy) |
| occurred_at | timestamp | |

Keep `metadata` flexible (jsonb) rather than adding a new column per event type — the taxonomy will grow faster than the schema should.

## Event taxonomy — what to capture and why

Grouped by what question it eventually answers. Every event type below should be wired in during the phase of `CLAUDE.md` where that feature is built — don't defer instrumentation to "later."

**Demand signal (the core B2B value later — how much unmet demand exists per event):**
- `event_page_view` — someone looked at an event's page. metadata: referrer source.
- `waitlist_joined` / `waitlist_left`
- `listing_viewed`
- `search_no_results` — a search or browse that found nothing; this is one of the highest-value signals for a promoter ("X people wanted a ticket to something like this and couldn't find one").
- `listing_created` — supply-side signal, metadata: price (face value or authorized), time-to-fill later derived from this + `purchase_completed`.

**Transaction outcomes (funnel health + eventual "how much volume moved" reporting):**
- `purchase_initiated`
- `purchase_completed` — metadata: amount, fee_amount, verification_tier used.
- `purchase_disputed` / `purchase_refunded`
- `listing_expired_unsold`

**Trust/fraud (product health, also relevant to a promoter's "is this a safe channel" question):**
- `verification_tier_a_success` / `verification_tier_b_used`
- `duplicate_listing_flagged`

**Social/virality (useful both for product growth metrics and, later, for showing a promoter organic reach around their event):**
- `share_link_created` / `share_link_opened`
- `friend_added`
- `attendance_confirmed`

**Account (basic lifecycle, standard product analytics):**
- `signup_completed`, `login`

Don't add device/location/session-level tracking beyond what's needed for basic product debugging — it's not useful to the eventual B2B use case and it's exactly the kind of "collect it because we might want it" field Law 25's minimization expectation argues against.

## Rollup tables (design now, populate whenever the first dashboard work actually starts)

Sketch these so the schema exists even before anything queries them:

- `EventDemandSummary` — per event: total waitlist joins, total listing views, total listings created, total sold, unmet-demand estimate (waitlist size minus listings filled), sell-through time. No user-level identifiers.
- `EventEngagementSummary` — per event: share count, attendance confirmations, unique viewers (count only, not the list of who).

Any rollup exposed outside the core team enforces a **minimum-count threshold** (e.g., suppress or bucket any stat derived from fewer than 5 users) so aggregate data can never be reverse-engineered to identify an individual — build this rule into the rollup computation itself, not into the (not-yet-built) dashboard layer, so it can't be bypassed by whatever queries the rollups later.

## Retention guidance

| category | suggested retention | why |
|---|---|---|
| raw `AnalyticsEvent` rows | 24 months, then delete or hard-anonymize | balances having enough history for trend reporting against minimization |
| rollup tables | indefinite (already aggregated/anonymized) | no individual data to retain risk on |
| transaction records | per standard financial record-keeping requirements (confirm with counsel — likely longer than 24 months) | legal/accounting need, distinct from analytics retention |

## Non-goals for this file's scope

- No promoter-facing dashboard, export tool, or API in v1 — this file defines capture and rollups only.
- No cross-event or cross-user profiling beyond what's listed in the taxonomy above.
- No selling or sharing of raw (non-aggregated) data, ever — this should be a stated principle in the privacy policy, not just an engineering default.
- No tracking-technology consent dark patterns — Law 25 requires real opt-in for identifying/profiling tracking technologies; don't ship a cookie banner designed to be clicked through without reading.
