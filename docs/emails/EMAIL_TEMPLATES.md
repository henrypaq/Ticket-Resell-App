# Email notifications — Resend templates

Scope: the four notification emails that make sense to build against the app's
*current* state (beta waitlist + `/go` lead capture). A longer list of
product-stage notifications (real purchases, escrow, cancellations) is
deferred to the bottom of this file until those flows exist for real users.

## Status — what's built vs. wired

Read this table before touching any of these — it's the one place that
answers "is this actually sending" without re-reading the whole file.

| # | Template | Design | Wiring | Trigger (once wired) |
|---|---|---|---|---|
| 1 | Waitlist welcome | ✅ built, preview below, awaiting sign-off | ⏸ not wired | `submitBetaSignup` (`src/domains/beta-signup/service.ts`) |
| 2 | Event waitlist joined | ✅ built, preview below, awaiting sign-off | ⏸ not wired | `setBetaEventInterest`, `intent: "waitlist"` |
| 3 | Sell interest confirmed | ✅ built, preview below, awaiting sign-off | ⏸ not wired | `setBetaEventInterest`, `intent: "sell"` |
| 4 | Event request received | ✅ built, preview below, awaiting sign-off | ⏸ not wired | `submitBetaEventRequest` |
| 5–11 | See § Deferred at the bottom | ⛔ no template built yet | ⏸ not wired | n/a |

**Wiring is deliberately on hold as of 2026-09-13** — not blocked on
anything technical, but the user flow that decides where these triggers live
(the `/go` + main-app merge discussed above) is about to change. Wiring
against today's trigger points risks wiring against code that's about to
move. **Do not add `sendEmail()` calls for any of these until that flow
change lands and this table is explicitly updated to say otherwise.** When
it's time to revisit: confirm the new trigger points still match the ones in
this table (they may not, post-merge), then follow § Implementation notes at
the bottom.

*(Exception, 2026-09-14: waitlist **offer** SMS/email in
`domains/beta-matching/notify.ts` is a separate lifecycle — claim holds,
expiry, paid — and is wired. It does not use the four templates below.)*

No code changes have been made toward sending any of these — every part of
this file so far is design (HTML previews) and copy (this doc), not
application code.

Brand system for these templates — deliberately **not** a copy of the app's
own dark-first UI (`CLAUDE_SPECS/STYLE.md`). An inbox is a different medium:
the goal here is to stand out against a wall of white/gray transactional
email, so the brand yellow carries the page instead of being a narrow accent.

| token | value | usage |
|---|---|---|
| brand yellow | `#F7CD19` | dominant background — header, page ground, footer accent (from `public/icon.svg`, standardized to one yellow instead of the app's two near-duplicate yellows) |
| ink black | `#0B0B0C` | logo badge, headline, CTA button, footer band |
| white | `#FFFFFF` | the content card — the one place body copy actually sits |
| body text | `#46464A` | paragraph text on white (softer than pure black, keeps the headline as the darkest text on the card) |
| muted (on black) | `#9A9A9E` / `#6B6B70` | footer secondary lines, on the black footer band |
| muted (on black card) | `#C7C7CA` | supporting copy inside a black status/callout card (event card meta line, sell-module body) |

Layout logic: **yellow frames it, white holds the message, black closes it.**
Header (yellow) → message card (white) → footer band (black, full-bleed, no
inset) — three flat fields, no borders/pills doing the separation. Logo mark
is a black circle (inverted from `icon.svg`'s yellow-on-black so it reads
against the yellow header instead of blending into it), sized large and
centered, with the full "mcgill.tickets" wordmark set small beneath it —
that pairing (big mark, small full name) repeats at reduced scale in the
footer so the sign-off reads as deliberate, not truncated.

Headline face is a websafe serif stack (`Charter, Georgia, 'Times New Roman', serif`)
standing in for Fraunces — email clients strip self-hosted `@font-face` too
unreliably to depend on it. Logo/wordmark text uses a bold display sans
(`'Arial Black', Arial, sans-serif`) for weight; body/UI text stays on the
system sans stack.

No status pills, badges, or location chips — hierarchy comes from type size
and whitespace (a large serif headline, a wider-spaced list, more room
between sections) rather than small decorative components.

**All four templates are now built as previews**, all sharing the one shell
that got the design review (logo lockup, card, event card, sell/waitlist
callout, footer) — only the headline, event card, and callout content differ
per template:

| template | preview |
|---|---|
| 1. Waitlist welcome | https://claude.ai/code/artifact/d36ab0cc-9380-4a3f-91b6-b81197a8c383 |
| 2. Event waitlist joined | https://claude.ai/code/artifact/abcf6428-e7fb-43a7-b179-6ae2d5b270be |
| 3. Sell interest confirmed | https://claude.ai/code/artifact/1ce3717a-e1d2-4352-9310-5b08803aaf04 |
| 4. Event request received | https://claude.ai/code/artifact/f8d2bf82-3024-47de-9d50-5aecc8f90443 |

Resize the browser window on any of them — each reflows at the 600px
breakpoint the same way it will in an inbox.

The preview renders the email's real table markup directly on the page
(no iframe) — an earlier iframe+JS-measured-height version kept developing a
stale-height bug that left a strip of yellow showing below the footer band on
mobile, and patching the measurement twice didn't hold, so the iframe was
removed rather than patched a third time. This means the preview is no
longer byte-for-byte copy-paste into Resend's `html` field: production needs
two things back that a browser tab doesn't, both dropped from the preview
for this reason — the hidden preheader `<div>` (drives the inbox preview-text
snippet) and the `color-scheme`/`supported-color-schemes` meta tags. Carry
both forward when this shell gets adapted into
`src/lib/email/user-notification-templates.ts`.

### Design QA checklist (re-run this when adapting the shell to templates 2–4)

- [x] Yellow is the dominant field — header and page ground, not a narrow accent.
- [x] Message content sits in a white card; the footer is a black band — no gray/dark-UI containers carried over from the app.
- [x] No pill/chip/badge components anywhere (no status tag, no location tag).
- [x] Logo mark is large and centered in the header, not a small corner lockup.
- [x] Footer carries the full "mcgill.tickets" wordmark (not just the `m.t` mark), styled as a real sign-off — address, unsubscribe, copyright.
- [x] One clear largest element (the serif headline) — everything else visibly subordinate to it, with real whitespace between sections instead of dense stacking.
- [x] Every remaining copy point lives in the element that matches its role, not a uniform list: the "we'll notify you" promise is prose in the main body, the event itself gets a real photo card, and the sell path is its own visually distinct module — nothing generic is left doing double duty as a list item.
- [x] The event the email is actually about (flyer photo, name, day/venue) is a prominent, unmistakable feature — not a line of text among others.
- [x] A working link/button into the app sits with the event card, so "here's your waitlist" has an actual destination, not just a status line.
- [x] The sell pivot has its own headline, supporting copy, and CTA, styled distinctly (tinted panel) from the primary flow — visually a deliberate "or, do this instead," not another bullet.
- [x] `color-scheme`/`supported-color-schemes` meta set to `light` (page is intentionally light/yellow now, not dark) so clients don't auto-invert it.

---

## Answering: what about the `/go` buy/sell "request received" emails?

Dropped from the build list — here's why.

**`/go` doesn't collect an email address today.** `quickBuySchema` /
`quickSellSchema` (`src/domains/beta-quick/service.ts`) and `GoContactProfile`
(`src/domains/beta-go/contacts.ts`) key contact on **WhatsApp phone + Instagram
handle** — that's it, except for the one-off Café Campus ticket-*transfer*
email field, which identifies who receives the ticket, not how we reach the
submitter. So a "we got your `/go` request" email has nowhere to send to for
most `/go` submissions today; the honest medium for that confirmation right
now is what already exists — the `/go` hub page itself and a WhatsApp/IG
follow-up, not email.

**Once `/go` and the main app merge** (single account, email as the shared
identifier — per your note that this is the direction), a buy request becomes
indistinguishable from joining an event's waitlist, and a sell request becomes
indistinguishable from confirming sell interest. That's template **2** and
**3** below. Building separate "`/go` request received" emails now would mean
throwing them away at merge time; building 2 and 3 to be entry-point-agnostic
(triggered off the same `beta_member_interests` row regardless of whether it
was created from the landing page questionnaire or from `/go`) gets the same
result once `/go` submissions are linked to an email via
`findMemberIdByContact`.

Net: no `/go`-specific templates. Templates 2 and 3 already cover that intent
and should fire whenever the person has an email on file, whichever flow
created the interest row.

---

## Building now

### 1. Waitlist welcome

**Trigger:** `submitBetaSignup` succeeds and inserts a new `beta_members` row
with a usable email (skip on the idempotent-resubmit path — don't re-welcome
someone who already got this).

**Data dependency this revision introduces:** the template now features one
specific event front-and-center (flyer, name, venue/day, a "View your
waitlist" button), so the send needs to resolve *which* event to feature —
`submitBetaSignup` already seeds `beta_member_interests` from
`input.interestedEvents` for known slugs, so the natural source is **the
first known-slug event the signup questionnaire seeded**. Two edge cases to
decide before wiring this up:
- **No event flagged at signup** (empty `interestedEvents`, or none matched a
  known slug): the event card has nothing to show. Either fall back to a
  card-free variant of this template (closer to the original body-only copy),
  or feature one currently-supported event as a generic "here's what's live
  right now" card — pick one deliberately rather than defaulting silently.
- **Multiple events flagged:** feature the first and don't try to fit more
  than one card — a multi-event digest is a different, denser email, not a
  variant of this one.

**Subject:** `You're in — welcome to mcgill.tickets`
**Preview text:** `We'll email you the second something matches what you're after.`

**Body copy:**

> **You're in.**
>
> **[Event card: {{eventFlyerUrl}} photo, "{{eventName}}", "{{eventDay}} · {{eventCity}} · on the waitlist"]**
> **[View your waitlist →]** *(links into the app, not just to the homepage)*
>
> You're on the waitlist for **{{eventName}}**. When it's your turn to buy a
> ticket, you'll get an email with the price and a link straight to it.
>
> Send the amount by e-transfer to reserve your ticket, and you'll receive it
> automatically from the seller. If it doesn't arrive within 15 minutes, your
> money is refunded in full — and if the price isn't right for you, you're
> welcome to pass and wait for the next one.
>
> **Got a ticket to sell instead?** *(bold black module, yellow serif
> headline, yellow CTA button — deliberately as high-contrast as the event
> card above it, not a muted aside; no divider line above it — spacing alone
> separates it from the paragraph)*
> List it at face value in under a minute. Once someone reserves it, their
> e-transfer comes straight to you — send the ticket over and you're done.
> **[List your ticket →]**
>
> Questions? Just reply to this email — a real person reads these.
> mcgill.tickets · Montréal, QC · Unsubscribe

Three rounds of restructuring from the first draft, all still standing: the
old numbered 01/02/03 list is gone (point 01 folded into the intro paragraph,
point 03 into the sell-callout's supporting line). The intro paragraph moved
to sit **under** the event card rather than above it — lead with the visual,
follow with the explanation. The paragraph's wording then changed from
promotional ("no more trusting a screenshot," "before anyone browsing the
feed even sees it") to a plain, procedural description of the actual
mechanics: what triggers the next email, and what buying then looks like —
nothing it claims goes beyond what `notifyWaitlistOfMatch` actually does
today (see deferred item 1 below; don't imply a priority window or reserved
time slot that doesn't exist in that trigger). And the sell callout was
restyled from a muted pale-yellow tinted panel to a solid black card with a
yellow serif headline and a yellow pill CTA, with the divider line above it
removed — whitespace alone now separates it from the paragraph, with even
internal gutters (`32px` on every side) instead of the original uneven
padding.

**Flag — this now describes the manual e-transfer flow, not the spec's Phase 1
escrow:** the payment paragraph was rewritten to match what the `/go` flow
actually runs today — buyer e-transfers a seller-linked contact
(`etransferName`/`etransferEmail`/`etransferPhone`, see
`src/domains/beta-quick/service.ts` and the quick-lead admin alert
templates), with a short delivery window and a manual refund path if it
doesn't come through. `CLAUDE_SPECS/CLAUDE.md`'s § Non-goals for v1
explicitly lists Interac e-Transfer support as **out of scope**
("harder to escrow... a later evaluation"), and Phase 1 as spec'd is Stripe
Connect hold-and-release instead. Right now the live beta process and the
roadmap disagree on this point — worth reconciling explicitly (either update
the spec's revision log to reflect that e-transfer is the actual interim v1
mechanism, or plan to swap this paragraph out once real Stripe escrow lands
for the main waitlist purchase path) rather than letting the mismatch sit
silently. Not something to resolve by guessing in this file.

**Status:** built — see preview link and design QA checklist above, awaiting your review.

---

### 2. Event waitlist joined

**Trigger:** `setBetaEventInterest` with `intent: "waitlist"`, `active: true`
— entry-point-agnostic per the `/go` note above, so this fires whether the
interest row came from the beta questionnaire, the per-event waitlist toggle,
or (post-merge) `/go`'s buy flow.

**Subject:** `You're #{{waitlistPosition}} in line for {{eventName}}`
(fallback subject when there's no numbered position yet: `You're on the list for {{eventName}}`)

**Preview text:** `We'll email you the moment a ticket opens up.`

**Preview:** https://claude.ai/code/artifact/abcf6428-e7fb-43a7-b179-6ae2d5b270be
(example event: Niska @ Bell Centre, position #3 — swap in the fallback
subject/headline for the no-position-yet case rather than building it as a
separate mockup)

**Body copy:**

> **You're #{{waitlistPosition}} in line.** *(falls back to a plainer "You're
> on the list." headline when there's no position yet — same size/weight,
> just no number)*
>
> **[Event card: {{eventFlyerUrl}} photo, "{{eventName}}", "{{eventDay}} ·
> {{eventCity}} · #{{waitlistPosition}} in line"]**
> **[View your waitlist →]**
>
> Positions move as tickets get listed, so this isn't a fixed queue — just
> where things stand right now. The moment a real, verified ticket for
> **{{eventName}}** goes live, you'll get an email with the price and a link
> straight to it.
>
> Send the amount by e-transfer to reserve your ticket, and you'll receive it
> automatically from the seller. If it doesn't arrive within 15 minutes, your
> money is refunded in full — and if the price isn't right for you, you're
> welcome to pass and wait for the next one.
>
> **Got a ticket to sell instead?** *(identical module to template 1 — same
> copy, same styling; the pitch doesn't change based on which page put you on
> a waitlist)*
>
> Didn't mean to join this waitlist? You can manage it any time from your
> account.
> mcgill.tickets · Montréal, QC · Unsubscribe

The payment paragraph and the sell callout are copied verbatim from template
1 — same flag applies (§ manual e-transfer vs. spec'd Stripe escrow, see
above). Only the headline, event card, and closing line are template-specific.

**Status:** built — see preview link above, awaiting your review.

---

### 3. Sell interest confirmed

**Trigger:** `setBetaEventInterest` with `intent: "sell"`, `active: true`,
`sellerTermsAccepted: true` — same entry-point-agnostic note as above.

**Subject:** `Got it — your {{eventName}} ticket is queued to sell`
**Preview text:** `We'll reach out to get it listed at face value.`

**Preview:** https://claude.ai/code/artifact/1ce3717a-e1d2-4352-9310-5b08803aaf04
(example event: Piknik Électronik)

**Body copy:**

> **You're listed.**
>
> **[Event card: {{eventFlyerUrl}} photo, "{{eventName}}", "{{eventDay}} ·
> {{eventCity}} · listed to sell"]**
> **[Manage your listing →]**
>
> Thanks for confirming you've got a ticket to **{{eventName}}** to sell.
> We'll follow up on {{contactMethodLabel}} to confirm the details, then your
> listing goes live.
>
> Your price is capped at face value — no bidding, no markup, no exceptions.
> Once someone reserves it, their e-transfer comes straight to you — send the
> ticket over and you're done.
>
> **Need a ticket instead?** *(the sell callout's mirror image — a waitlist
> nudge instead of a sell nudge, since this reader is already selling)*
> Join a waitlist for whatever you're trying to get into — we'll email you
> the second a real, verified ticket goes up.
> **[Browse events →]**
>
> Changed your mind? You can pull this listing any time from your account.
> mcgill.tickets · Montréal, QC · Unsubscribe

Note: `{{contactMethodLabel}}` renders as "WhatsApp" or "Instagram" from
whichever contact field is actually on file — don't hardcode one (the
preview mockup shows "WhatsApp" as the example). Same manual e-transfer flag
as template 1 applies to the payout line.

**Status:** built — see preview link above, awaiting your review.

---

### 4. Event request received

**Trigger:** `submitBetaEventRequest` inserts a row into
`beta_member_event_requests`.

**Subject:** `We got your event request`
**Preview text:** `We'll take a look and add it if we can.`

**Preview:** https://claude.ai/code/artifact/f8d2bf82-3024-47de-9d50-5aecc8f90443
(example: "Bad Bunny — Bell Centre," a plausible unsupported event)

**Body copy:**

> **Got it.**
>
> **[Status card: no photo — "{{requestedEventName}}", "Submitted · under
> review". Deliberate text-only variant of the event card, since a requested
> event has no flyer to show yet.]**
>
> Thanks for flagging **{{requestedEventName}}** — we hadn't added it yet. An
> admin reviews every requested event before it's postable, which is what
> keeps the face-value price cap trustworthy on every listing across the app.
>
> If we can verify it, it'll show up in the app and you'll be able to join
> its waitlist or list a ticket against it. We don't have a way to notify you
> the moment that happens yet, so check back next time you're browsing.
>
> **In the meantime** *(same module position as the other three templates'
> sell/waitlist callouts, repurposed here to point at events that are already
> live rather than a sell/buy pitch)*
> {{supportedEventsShortlist}} are already live — join a waitlist while you
> wait on this one.
> **[Browse events →]**
>
> Questions? Just reply to this email — a real person reads these.
> mcgill.tickets · Montréal, QC · Unsubscribe

**Status:** built — see preview link above, awaiting your review. Worth
noting: this is the one template above with no real "it's ready" follow-up
loop yet — that gap is exactly *deferred item 7* below (admin approval
notice), so treat this one as intentionally half a loop until that ships.

---

## Deferred — build later, not now

Kept here so the list survives even though nothing below gets built this
pass. Each depends on a product flow (real purchases, escrow, verification)
that either isn't live yet or isn't live for real users yet.

1. **Waitlist match found** — email twin of the existing in-app
   `notifyWaitlistOfMatch` notification (`src/domains/notifications/service.ts`,
   type `waitlist_match`). This is the highest-value one to build next once
   email delivery for #2/#3 is live — it's the same trigger, just needs an
   email leg added alongside the existing DB insert.
2. **Listing is live** — seller confirmation their ticket posted successfully
   to a real (non-`/go`) listing.
3. **Purchase confirmation / receipt** — itemized price breakdown; this one
   is compliance-load-bearing (§ hard constraints in `CLAUDE_SPECS/CLAUDE.md`
   require the disclosure at time of purchase), so build it against the real
   `Transaction`/`disclosure_snapshot` model, not a rough draft.
4. **Payment held (escrow)** — buyer reassurance while a Phase 1 manual
   release, or Phase 2 automated release, is pending.
5. **Payment released** — seller payout notice, fired off the same release
   event whether it's the Phase 1 manual admin trigger or Phase 2's automated
   one.
6. **Event cancelled/changed** — the cascade notice required by hard
   constraint #4 (producer → platform → every affected listing/user). This
   is a compliance requirement, not a nice-to-have — flag it for its own
   review pass rather than folding it in casually.
7. **Event request approved** — closes the loop that template 4 above
   deliberately leaves open; fires when an admin flips a requested event from
   `pending` to `discoverable`/`resale_enabled`.

---

## Implementation notes

- **Where this goes in code:** parallel to
  `src/lib/email/admin-alert-templates.ts`, add
  `src/lib/email/user-notification-templates.ts` exporting
  `{name}EmailSubject` / `{name}EmailText` / `{name}EmailHtml` functions per
  template, following that file's existing pattern exactly. Wire sends
  through the existing `sendEmail()` in `src/lib/email/resend.ts` — no new
  transport needed.
- **Plain-text part:** every `{name}EmailText` function needs a real
  plain-text equivalent (not html-stripped) — same convention as
  `betaInterestEmailText` / `quickLeadEmailText`.
- **CASL:** these are commercial electronic messages to a Canadian audience —
  each template's footer needs a working unsubscribe link and the sender's
  identity/mailing address (placeholder `Montréal, QC` above; swap for the
  real registered address before sending for real). Don't ship without a
  functioning unsubscribe path wired to `notify_*` prefs in `beta_members`.
- **Fail open:** match `notifyAdminsOfBetaInterest`'s convention — never let
  an email failure block the user-facing action that triggered it.
- **`/go` merge dependency:** templates 2 and 3 firing for `/go`-originated
  interest rows depends on that row being linked to an email via
  `findMemberIdByContact` (`src/domains/beta-go/contacts.ts`). Until that
  link is reliable, those two templates only fire for interest rows that
  came in through the main beta signup flow.
