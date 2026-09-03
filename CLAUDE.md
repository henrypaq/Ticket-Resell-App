# Working in this repo

The specs in `CLAUDE_SPECS/` are the source of truth. Read them before making
changes:

- `CLAUDE_SPECS/CLAUDE.md` — the feature/phase roadmap and the § hard
  constraints. Treat those constraints as acceptance criteria, not background.
- `CLAUDE_SPECS/SECURITY.md` — security requirements, applied from Phase 0.
- `CLAUDE_SPECS/ARCHITECTURE.md` — layering, testing, data integrity.
- `CLAUDE_SPECS/DATA_CAPTURE.md` — analytics taxonomy and privacy constraints.
- `CLAUDE_SPECS/STYLE.md` — the visual design system, read alongside the images
  in `CLAUDE_SPECS/design-references/`.

Current state, setup, and known gaps: see `README.md`.
Decisions with real tradeoffs: `docs/adr/`.

Two rules worth repeating here because they are easy to break by accident:

1. **Never add a code path that lets a listing price exceed the cap.** The cap is
   face value, or `event_authorizations.max_resale_price` when a row exists.
   Enforcement is layered on purpose (see `docs/adr/0002-*`); don't remove a
   layer because another one covers it.
2. **Never label or structure a fee as a "transfer fee."** `SERVICE_FEE_LABEL` in
   `src/lib/compliance/fees.ts` is the only place that string is defined.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
