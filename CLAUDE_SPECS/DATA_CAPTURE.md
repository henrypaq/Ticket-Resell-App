# Ticket Platform Data Capture System — Brief for Claude Code

**Audience:** Claude Code, working directly in this codebase and against our live Supabase project.
**Premise:** treat this as a requirements brief, not a schema to copy-paste. You have direct access to the current database and codebase — I don't, and a lot has changed recently, so don't assume anything below about what tables, columns, or conventions already exist. Start by looking, then design.

---

## 1. The problem

We need a well-structured system for capturing everything that happens around tickets on the platform: tickets being listed/added, tickets being sold, who's buying and selling, and the transactions connecting them — plus whatever else turns out to be relevant once you look at how the app actually works today.

Three things matter about *how* this data is captured, not just that it is:

1. **It should be easy to query.** Someone (or something) should be able to ask reasonable questions of this data — "how many tickets sold for event X," "who bought from seller Y," "what happened to transaction Z" — without archaeology.
2. **It should make problems visible.** Bad states (oversold listings, mismatched totals, tickets stuck in limbo, orphaned records) should be *discoverable by query*, not something we find out about from a user complaint.
3. **It should be analytics-ready from day one**, because we're going to build a data product for event organizers on top of this later — sales velocity, revenue, buyer behavior, timing — and it's much cheaper to capture the right granularity and timestamps now than to backfill it later.

## 2. What "done" looks like

Rather than prescribing tables, here's the bar the implementation should clear. Use your judgment — informed by what's actually in the codebase and database — on the concrete design.

**Coverage.** Every ticket (from creation/listing through its final state — sold, transferred, redeemed, cancelled, refunded, expired, whatever the real lifecycle turns out to be), every buyer and seller, every transaction, and the relationships between them should be captured somewhere queryable. If the app currently has any manual or semi-manual processes around this (e.g., anything not yet fully self-serve in-app), the data model should still be able to represent those records, not just future in-app ones.

**Timestamps and provenance.** Every meaningful state change should carry a timestamp, and ideally who/what caused it (a user, an admin, a webhook, a script). "When did this ticket get listed, reserved, sold, redeemed" and "when did this transaction move from pending to paid" should all be answerable, not just "what's the current state."

**History, not just current state.** Current-state tables alone won't satisfy the "surface issues" goal — you need some way to reconstruct what a record looked like before its last change and who/what changed it. This is usually solved with either an audit/event log pattern or a proper event-sourced design; pick whichever fits the existing codebase's patterns and the team's comfort level, but don't skip it. This is the single most important piece for making issues discoverable after the fact rather than only preventable in the moment.

**Structural integrity.** Money should not live in floating-point columns. States that shouldn't coexist (e.g., a ticket "sold" with no transaction behind it, a listing with more sold tickets than it was created with) should be either structurally prevented (constraints) or at minimum cheaply detectable (a query or view you'd actually run). Status/lifecycle fields should be constrained to a known set of values in a way that's easy to extend later — be wary of Postgres `ENUM` types specifically, since adding values to them has migration/locking gotchas; a `CHECK` constraint on a text column is usually the more maintainable choice, but again — use your judgment given what's already there.

**Appropriate access control.** Buyers and sellers should be able to see their own data; they generally shouldn't see each other's or other people's. Admins/staff need broader visibility. If Supabase Row Level Security is already in use elsewhere in the project, extend that pattern consistently rather than introducing a second access-control approach. Sensitive write paths (anything that changes money or ticket ownership) should go through something more controlled than a raw client-side update — a server function/RPC with proper locking, so two buyers can't both "win" the same ticket.

**Analytics surface.** On top of the raw tables, there should be a queryable layer (views, materialized views, or an API — whatever fits) that answers the organizer-facing questions we already know we'll want: tickets sold vs. available per event, revenue over time, sales velocity, seller performance, repeat-buyer/attendee behavior. You don't need to build the organizer product itself — just make sure the underlying data supports it without redesign.

## 3. How to approach it

1. **Look before designing.** Inspect the current Supabase schema (tables, RLS policies, functions/triggers already in place) and how the app's code reads and writes ticket/transaction data today. Understand the current ticket lifecycle and checkout flow as they actually exist, not as I've described them — I'm working from an old understanding of this platform and it may well be wrong now.
2. **Reconcile, don't duplicate.** If something like ticket/transaction/buyer/seller records already exists in some form, extend and improve it rather than building a parallel system. If you find the existing shape is fundamentally at odds with the goals in §2 (e.g., no history/audit trail at all, money stored as floats, no real separation between listings and individual tickets), flag that clearly and propose a migration path rather than silently working around it.
3. **Match existing conventions.** Naming, migration file structure, and how RLS/triggers/functions are organized elsewhere in this codebase should guide the new work, so this doesn't read as a bolted-on system.
4. **Design the schema and write the migrations.** Tables/columns, constraints, indexes, RLS policies, and whatever audit/history mechanism you choose.
5. **Build the analytics layer** described in §2, informed by what the organizer data product will plausibly need.
6. **Write something that actively finds problems** — a query, view, or scheduled check that surfaces the kinds of bad states described under "structural integrity" above. It doesn't need to be exhaustive on day one, but it should be easy to extend as new failure modes turn up.
7. **Verify it for real.** Don't just eyeball the SQL — apply the migrations against a real (or local/staging) Postgres instance, seed representative data, and confirm: the history/audit mechanism actually captures changes, access control actually restricts who can see what (test as more than one role, not just as an admin/superuser), and a deliberately-corrupted record actually gets caught by the integrity checks. Report back on what you tested and how, not just that it "should work."

## 4. Non-goals

This is about the data layer. Out of scope unless it turns out to be tangled up with it:

- Payment provider integration itself (webhook handling logic) — the data model should be able to *receive* that information, but building the integration is separate.
- Auth/onboarding flows.
- The organizer-facing dashboard UI.
- Ticket scanning/entry-validation app logic.

## 5. Before you finish

Summarize the design decisions you made and why — especially anywhere you deviated from or extended what already existed — so this is reviewable without re-reading every migration line by line.