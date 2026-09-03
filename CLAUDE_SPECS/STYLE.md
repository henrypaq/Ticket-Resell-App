# STYLE.md — Visual Design System

Companion to `CLAUDE.md`, `SECURITY.md`, and `ARCHITECTURE.md`. This file governs how the app looks — colors, type, spacing, and the specific component patterns below. It's derived from reference screenshots saved in `design-references/` in this repo; read this file alongside those images, not as a substitute for looking at them.

**Reference images and what each is for:**
- `design-references/home-for-you.png` — primary reference for the main feed: featured event card, section headers, floating bottom nav.
- `design-references/upcoming-list.png` — primary reference for list rows, filter chips, tag pills.
- `design-references/search-empty.png` — reference for search input styling and empty-state tone.
- `design-references/profile.png` — reference for avatar treatment, stat rows, and card patterns.
- `design-references/event-detail-mockup.png` — reference for an event detail layout (flyer + lineup avatars); closest available reference for the ticket/event detail page, though it doesn't show an actual ticket/QR view.

A sixth reference (a light-mode movie-browsing app) was deliberately **not** carried into this repo — it's a different color scheme and domain, useful only as loose inspiration for the horizontal poster-carousel and bottom-tab shape, not as a styling source. Don't pull light-mode values from it.

## Design direction

Dark-first, premium nightlife/ticketing aesthetic — closer to DICE, Shotgun, or Resident Advisor than a typical marketplace app: high contrast, confident typography, full-bleed imagery, minimal chrome. This app moves money and verifies tickets against fraud, so the visual polish is doing real work, not just decoration — a clean, uncluttered, well-crafted UI is part of what makes users trust it enough to pay through it. Avoid anything that reads as cheap or ad-cluttered: no stock-photo gradients, no dense forms, no more than one accent color fighting for attention on a screen.

## Color system

Read off the references as a starting point — treat these as placeholder values to refine with real hex/brand colors once chosen, not final:

| token | approx. value | usage |
|---|---|---|
| `bg/base` | near-black, ~#0B0B0C | app background |
| `surface/card` | elevated dark gray, ~#17171A | cards, the floating nav — distinct enough from base to read as a layer without a shadow |
| `surface/pill` | translucent white, ~rgba(255,255,255,0.08) with a soft 1px border | filter chips, location pill, tag pills — never a solid heavy fill |
| `border/hairline` | ~#2A2A2E | card edges, dividers — used sparingly |
| `text/primary` | off-white, ~#F5F5F5 | titles, primary content (not pure #FFFFFF — softer) |
| `text/secondary` | mid-gray, ~#9A9A9E | metadata, timestamps, counts |
| `accent/urgency` | warm amber, ~#F5A623 | time-pressure signals only (e.g., "4h left") — narrow, deliberate use |
| `accent/primary-action` | off-white fill on dark | primary buttons ("Edit," "Sync," CTAs) — the references lean on white-on-dark rather than a saturated brand color for primary actions; reserve an actual accent color, once chosen, for small meaningful moments (active nav state, badges, notification dots) rather than large surfaces |

Since there's no shadow doing visual separation on a black background, borders and consistent surface tokens are what create layering — don't reach for `box-shadow` as the primary tool here.

## Typography

- **Headlines: Fraunces** (variable, self-hosted via `next/font`) — page titles ("Search," "Post a ticket") and event/listing titles, via the `.headline` utility. This is a deliberate deviation from the original "no custom typeface needed" — a serif display face on the title layer is what now separates a headline from a label. An app-wide version of this (Fraunces on everything, tuned small via its `opsz` axis) was tried and reverted; the scope is headlines only.
- Everything else stays on the **system sans stack** (SF Pro / Inter / equivalent) — metadata, body copy, buttons, form labels, and the section-header labels below. Fraunces' display forms don't hold up at small uppercase-tracked or dense UI sizes, so the swap stops at the title layer.
- **Section headers:** bold, uppercase, tight letter-spacing, relatively small point size relative to their visual weight (e.g., "FOR YOU THIS WEEK," "TODAY"). Sans, not Fraunces — see above.
- **Titles** (event names, display names): Fraunces via `.headline`, medium weight, sentence case, `text/primary`.
- **Metadata:** regular weight, `text/secondary`, small size. Metadata lives on the event detail page, not on browse surfaces — see § Event tile below.
- Discipline matters more than variety here: no more than two typefaces, two weights within each, and two text colors on any single card.

## Layout & spacing

- Generous, consistent padding between cards and from screen edges — whitespace and radius carry the "premium" feeling in the absence of shadows.
- Corner radius scale: large (~20–28px) on hero cards and image thumbnails, full-pill on buttons/chips/nav, medium (~12–16px) on smaller inline cards (empty-state box, expandable panels).
- Imagery is full-bleed inside its rounded container — flyers and photos fill the card edge-to-edge behind the rounding, not inset with padding around them.

## Core components

Mapped to where they're needed in `CLAUDE.md`'s phases.

### Featured event card & event tile — Phase 1 (event bulletin, browse / waitlist views)
**Superseded from the `home-for-you.png` / `upcoming-list.png` references below by explicit request: text moved from beside/beneath the image to inside it, and browse surfaces were stripped to title-only.** Both the hero card and the grid tile are the same shape — a full-bleed poster with a bottom gradient scrim and the title set directly over the image, not a photo with copy in a separate content area beneath it.

- **Hero** (the "For you" carousel): `aspect-[4/5]`, a stacked date badge (day-of-week + number) as a frosted chip in the top-left corner, event title in Fraunces at the bottom over the scrim. Dot pagination on the carousel, not arrows.
- **Tile** (every other browse list — Upcoming, Search results, waitlist grids): `aspect-[3/4]`, rendered two-up in a grid. Title only, no date badge, no price, no venue, no tags, no ticket-availability count. A favorite/heart icon (the waitlist toggle) sits as a frosted circular overlay in the top-right corner rather than aligned at the far right of a text row.
- **Everything the tile used to show — price, countdown, venue, tags, live-ticket count — moved to the event detail page.** The tile is for recognition and browsing; the page is for the decision to buy. Don't add metadata back to the tile for a new field; extend the detail page instead.

### Filter chips
Real, stateful, URL-param-backed filters (city/date/genre/price), not static presentational chips — a chip that renders but doesn't filter is unfinished, not done. Selected state is shown by an icon (a check) alongside the pill's fill change, never by fill color alone (§ accessibility).

### Floating bottom navigation
A pill-shaped bar floating with margin from the screen edges (not edge-to-edge), translucent/frosted dark background. 2–4 destinations shown as icon+label pairs; active state is a filled icon plus brighter text rather than a color swap, keeping the mostly-monochrome palette intact. Search gets its own separate circular floating button beside the pill rather than being folded into it — worth keeping this pattern, since search is a primary action here (people are usually looking for one specific event, not browsing). *(Reference: `home-for-you.png`, `upcoming-list.png`)*

### Search
Simple header, pill-shaped input with a leading search icon and a clear (×) button once text is entered. Empty state is friendly and specific rather than a bare blank screen — a thin outline icon (not an emoji — see § iconography) plus one warm, human line of copy, no supporting subtext beneath it (the reference's "It's quiet in your city for now" is a good model: honest and low-key, not apologetic or robotic). *(Reference: `search-empty.png`, adapted to drop the emoji.)*

### Home page sections — Phase 1/3 mix (main feed)
The home feed ("For you") composes several section types beyond the featured carousel and event tile above. Several of these are currently placeholder-data-only (no backing domain yet) — see `src/lib/placeholder-content.ts` for which.

- **Ranked community card:** a smaller variant of the poster tile (`w-32`, `aspect-[3/4]`) for a horizontal "most shared"-style rail. Same full-bleed-poster-plus-scrim language as the hero/tile, with a frosted rank-number badge in the date badge's corner/position instead of a date. Title only, same as every other browse tile — no visible share count until that's a real computed stat.
- **Venue profile card:** small square/portrait card in a horizontal rail — initials-avatar circle (same fallback treatment as `EventOrganizer`, since there's no Venue entity or image field yet), name, neighborhood. No action affordance.
- **Friend-activity row:** compact single-line list item — small circular initials avatar + "name — action — event," stacked vertically, no dividers, no per-row icon controls. Keep it to one line per person; this is a glance-list, not a feed.
- **Organizer-rec card:** wider card (`w-64`) in a horizontal rail, reusing `EventOrganizer`'s avatar+name+handle header but adding a short one-line blurb underneath. No follow button until Phase 3's Follow entity exists — see § Friends-going display below for the same rule applied to attendee display.

### Friends-going display — Phase 3 (social layer)
Not directly shown in the references, but should match their avatar language: small circular avatars with a thin border, arranged as an overlapping stack (show 2–4, "+N" for the rest), with "N friends going" in `text/secondary` beside the stack. Keep this as a compact single row on an event card or detail page — not a separate heavy section.

### Ticket / event detail page — Phase 2 (anti-fraud engine, user-facing side)
`event-detail-mockup.png` is the closest reference (flyer at top, title/date/venue in the established hierarchy, a lineup/attendee row of small circular avatars with names beneath), but it's a pre-purchase event page, not a post-purchase ticket. For the actual ticket view, add what the reference doesn't show but the product needs:
- A clear, prominent **verified/authenticity badge** tied to the Tier A/B verification from `CLAUDE.md` — this is a trust signal worth real visual weight, not a small icon tucked in a corner.
- The **QR/barcode itself**, large and high-contrast — put it on a near-white or white card even inside the otherwise-dark UI. QR codes need real contrast to scan reliably at a door in low light; don't force this element into the dark palette for consistency's sake.
- The **itemized price/fee disclosure** required by `CLAUDE.md`'s hard constraints, laid out cleanly as part of the page, not as small-print at the bottom.

### Profile
Large circular avatar, bold display name, gray handle beneath. A stat row directly under the name, separated by thin vertical dividers, text-only (no icons needed here per the reference). *(Reference: `profile.png`.)* The points/currency and "Fanprint"-style gamification elements in that reference are optional flourishes worth noting as future inspiration — they aren't called for in any current `CLAUDE.md` phase, so don't let styling work pull them into scope.

## Iconography

Thin, consistent-stroke outline icons throughout (pin, bell, heart, calendar, ticket, search, check). Don't mix filled and outline icon styles on one screen except deliberately, to mark an active/selected state. **No emoji anywhere in the product UI** — every place an emoji might seem like the fast answer (empty states, success confirmations, selected-state marks) gets a thin outline icon from this set instead, so the icon language stays one consistent thing rather than switching to platform emoji rendering mid-screen.

## Motion

Page navigation uses the browser's native View Transitions API (`document.startViewTransition`), not a JS animation library — a short cross-fade on the page shell, and a real shared-element morph for a poster image navigating from a grid tile or hero card into the event detail page (matched by a shared `view-transition-name`). This is progressive enhancement: browsers without support, and users with `prefers-reduced-motion: reduce` set, get an instant navigation with zero added cost — the transition is never required for the app to function, and it never adds a JS bundle. Prioritize an actual `loading.tsx` skeleton for any route that waits on data over animating the wait — a fast, unstyled state beats a polished one over a multi-second stall.

## Accessibility on a dark UI

- `text/secondary` gray-on-near-black is the easiest place for a dark theme to quietly fail contrast — check the actual contrast ratio against the base background (not just against the card surface), rather than trusting that it "looks fine" in a mockup.
- Never encode status by color alone (verified vs. unverified ticket, sold vs. available) — pair color with an icon or label. This matters more than usual here since a misread status is a fraud/money risk, not just a cosmetic one.

## Out of scope for this file

- This is a token/pattern reference, not a full screen-by-screen mockup set. Build against these rules plus `CLAUDE.md`'s feature list; when a new component type comes up that isn't covered here, extend this file with the same conventions rather than inventing an inconsistent one-off.
- Gamification (points currency, achievement-style stat cards) is explicitly not a v1 requirement — noted above as inspiration only.
