# Retired route files

These are the page/layout files of the old `src/app/(app)` route group — the
Supabase-authenticated Phase 0–3 product (`/home`, `/upcoming`, `/tickets`,
`/search`, `/profile`, `/notifications`, `/events/[id]`, `/sell`, `/u/[handle]`).

They were moved out of `src/app/` when `/member` and `/go` were merged into a
single beta app. Nothing was deleted:

- **Why they moved.** Route groups in parentheses add no path segment, so
  `(app)/upcoming` and `(app)/sell` owned `/upcoming` and `/sell` — the paths the
  merged app needs. Two `page.tsx` for one path is a build error.
- **What's still live.** Everything they depend on: `src/domains/{listings,
  payments,social,events,notifications,users,waitlist}`, the Supabase clients,
  `/admin`, `/login`, `/auth/*`, and the `src/components/*` they import
  (`bottom-nav.tsx`, `app-header.tsx`, `event-cards.tsx`, …). These files are
  still type-checked, so a change that breaks them breaks the build — that's
  deliberate.
- **`CLAUDE_SPECS/` still governs them.** Retiring routes is not the same as
  dropping the specced product; the phase roadmap and its § hard constraints
  still apply to this code.

To bring a route back, move its directory under `src/app/` (a route group like
`(app)` is fine) and remove the matching entry from `redirects()` in
`next.config.ts`.
