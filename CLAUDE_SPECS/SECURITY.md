# SECURITY.md — Production Security Guide

Companion to `CLAUDE.md`, `DATA_CAPTURE.md`, and `ARCHITECTURE.md`. This is a technical security guide — application, infrastructure, and operational security controls. It intentionally does not cover legal/regulatory compliance (data-protection law, consumer-protection rules); that's handled elsewhere in the project's docs. This app moves real money and holds identity-linked user data, which makes it a meaningfully higher-value attack target than a typical early-stage side project (real payment flows, valuable resale tickets, PII). Treat security as a first-class requirement in every phase of `CLAUDE.md`, not a pre-launch checklist.

## Threat model — what this app actually needs to defend against

Be explicit about this rather than applying generic advice blindly. The realistic attackers here are:

1. **Ticket fraudsters** — duplicate/replayed QR codes, screenshot resale of already-used or already-sold tickets, fake "I have a ticket" listings with no real inventory behind them.
2. **Account takeover / fake accounts** — mass creation of throwaway accounts to evade fraud/rate-limit controls, or takeover of a real user's account to post fraudulent listings or receive escrowed funds. Open signup (any email address, § `CLAUDE.md`) means fake-account creation is cheap, so the controls in this file — not a signup gate — are what have to carry the weight of preventing abuse.
3. **Payment fraud** — stolen card testing through the marketplace, chargeback abuse, escrow-release manipulation (claiming entry succeeded when it didn't, or vice versa).
4. **Admin/privilege abuse** — the `EventAuthorization` mechanism (§ `CLAUDE.md` Phase 4) is the single highest-value target in the whole system: whoever can create one controls pricing rules for real money. Treat the admin panel as the crown jewel, not an afterthought.
5. **Data exposure** — a breach here isn't abstract; it exposes real users' identities, contact info, and transaction history. With a smaller, closer-knit early user base, re-identification from data that looks "anonymized" is also easier than it would be at large scale — treat any data-handling decision with that in mind.
6. **Scraping/enumeration** — competitors or bad actors harvesting the event/listing feed or user directory.

Every control below maps back to one of these; if you're adding a security measure that doesn't address one of these six, ask whether it's actually needed here versus generic best-practice noise.

## Authentication & session security

- **OTP/magic-link auth** (per `CLAUDE.md`) needs its own hardening: rate-limit OTP requests per email and per IP, expire codes quickly (minutes, not hours), invalidate a code after one use, and rate-limit verification attempts to prevent brute-forcing a 6-digit code.
- **Session tokens:** short-lived access tokens plus a refresh mechanism, not long-lived tokens stored client-side indefinitely. Store tokens in httpOnly, secure, sameSite cookies where possible rather than localStorage — this closes off a large class of XSS-driven token theft.
- **No password-based auth in v1** — email OTP is both simpler and removes an entire category of credential-stuffing risk. Don't add password login later without also adding the standard hardening that comes with it (hashing with a modern algorithm, breach-list checking, MFA).
- **Email verification is a real round-trip, not a format check.** Send the OTP to the address and require it be entered back — never treat a syntactically valid email as a verified one. Since signup is open to any address (§ `CLAUDE.md`), consider basic signals against disposable/throwaway email providers if fake-account volume becomes a problem in practice, but don't over-build this speculatively before you see it happen.
- **Account lockout / anomaly response:** flag and throttle accounts showing patterns like rapid listing creation, many failed verification attempts, bursts of new signups from the same IP/device, or logins from wildly divergent locations in a short window.

## Authorization

- **Authorize on every request, server-side, never trust client-supplied identity or role claims.** Every endpoint that touches a `Listing`, `Transaction`, or `EventAuthorization` re-checks ownership/role on the server, even if the UI already hides the button.
- **The admin role is separate and minimal.** Don't reuse a generic "isAdmin" boolean sprinkled through the codebase — model admin capabilities explicitly (e.g., "can create EventAuthorization," "can process refunds") so a compromised low-privilege admin account can't do everything.
- **Every `EventAuthorization` creation is logged with who, when, and the agreement reference it's based on** (this is also a `CLAUDE.md` Phase 4 requirement) — from a security angle, this audit trail is what lets you detect and unwind abuse of the one mechanism that can move real money above face value.

## Payment security

- **Never touch raw card data.** Use Stripe Elements/Checkout/Payment Intents so card numbers never transit your servers — this keeps you out of the highest PCI-DSS scope tier entirely, which is the right call for a team this size.
- **Verify Stripe webhook signatures on every incoming webhook** — an unverified webhook endpoint is a direct path to spoofed "payment succeeded" events.
- **Idempotency keys on all payment-mutating operations** — retries (network blips, duplicate webhook delivery) must never double-charge a buyer or double-release escrow.
- **Escrow release is a privileged, audited operation.** Tie it strictly to verified conditions from `CLAUDE.md` Phase 2 (Tier A: API-confirmed transfer; Tier B: buyer confirmation or dispute-timeout resolution) — never allow a client-side call to directly trigger a release.
- **Reconcile Stripe's record of transactions against your own database on a schedule** — catches drift from bugs or tampering early rather than at dispute time.

## Ticket-fraud–specific controls

- **QR/ticket codes should not be static, guessable, or reused.** Where you're issuing your own verification codes (Tier B fallback), use signed, single-use tokens rather than a plain sequential ID or a copy of whatever the seller uploaded.
- **Duplicate-listing detection is a security control, not just a UX nicety** — hash/fingerprint uploaded ticket images or barcodes and check against prior listings before allowing a new one live.
- **Rate-limit listing creation per account** — a compromised or fake account spamming fraudulent listings should hit a wall fast.
- **File uploads (Tier B ticket images) get validated strictly:** enforce file type and size limits server-side (not just in the UI), strip metadata, and scan for malware before storage — don't trust client-reported MIME types.

## API & infrastructure hardening

- **Input validation on every endpoint**, server-side, using a schema validator (not ad hoc checks) — reject unexpected fields rather than silently ignoring them.
- **Parameterized queries / ORM only** — no string-concatenated SQL, anywhere, ever.
- **Standard web hardening:** CSRF protection on state-changing requests, strict CORS allow-list (not `*`), security headers (CSP, HSTS, X-Content-Type-Options, etc.), output encoding to prevent XSS in any user-generated content (listing descriptions, display names).
- **Rate limiting at the API gateway/edge**, not just in application code, so a flood can't reach the app layer in the first place.
- **Secrets never live in source control.** Use environment variables backed by a real secrets manager (not a `.env` file committed anywhere, even to a private repo) and rotate credentials on any suspected exposure.
- **Least-privilege service credentials:** the app's database user, Stripe key scope, and any cloud IAM roles should have exactly the permissions needed and nothing more — a compromised API server shouldn't be able to, say, delete the whole database if it only ever needs read/write on specific tables.
- **Separate environments (dev/staging/prod) with separate credentials and separate data** — production user data never flows into a lower environment for testing.

## Data protection (ties directly to `DATA_CAPTURE.md`)

- **Encryption in transit everywhere (TLS)** and **encryption at rest** for the database and any file storage (ticket uploads).
- **PII minimization is a security control as much as a privacy one** — the less sensitive data you hold, the smaller the blast radius of any breach. Follow `DATA_CAPTURE.md`'s minimization and retention guidance strictly.
- **Never log sensitive data** — no full payment details, OTP codes, or raw ticket images in application logs. Structured logs should reference IDs, not the sensitive payload itself.
- **Access to raw analytics/user data is itself access-controlled and logged** — not every engineer needs unrestricted production data access; prefer scoped read replicas or masked views for day-to-day debugging.

## Dependency & supply-chain security

- **Lockfiles committed, dependencies pinned.** Automated dependency and vulnerability scanning (e.g., Dependabot/Snyk-style tooling) wired into CI from Phase 0, not added later.
- **Review new dependencies before adding them**, especially anything touching payments, auth, or file parsing — supply-chain compromise of a widely-used package is a realistic risk, not a theoretical one.

## Logging, monitoring & incident response

- **Structured, centralized logging** with alerting on the patterns that matter here specifically: repeated failed OTP attempts, unusual listing-creation velocity, escrow releases outside the expected flow, `EventAuthorization` creation events.
- **Error tracking** (e.g., Sentry-style) wired in from early phases so failures in the payment/escrow path surface immediately rather than being discovered from a user complaint.
- **Have an actual incident response plan before launch, not after a breach.** At minimum, define in advance: who gets notified internally, how you determine severity/scope, the steps to contain and remediate, and how and when affected users get notified. (Separately from this file: breach-notification obligations may exist under data-protection law depending on where your users are — that's a legal question for counsel, not something this file addresses, but the operational security process here should be ready regardless of what the legal answer turns out to be.)

## Security testing & review cadence

- **Every phase in `CLAUDE.md` gets a security pass before being called done**, not just a functionality check — pricing/escrow logic (Phase 2, Phase 4) deserves particular scrutiny since it's both the compliance-critical and the security-critical path.
- **Automated security scanning in CI** (dependency vulnerabilities, basic SAST) as a merge gate, not a manual afterthought.
- **Before public launch:** a focused review or third-party assessment specifically of the auth flow, payment/escrow logic, and admin panel — these three surfaces carry disproportionate risk relative to the rest of the app.

## Non-negotiables — flag immediately if any of these are ever proposed as a shortcut

- Storing raw card numbers, even temporarily.
- A client-side-only check for anything security- or compliance-relevant (price caps, authorization, ownership) without an equivalent server-side enforcement.
- Long-lived, unscoped API keys or admin credentials shared across environments.
- Skipping webhook signature verification "to save time" in early development, if that code path has any chance of reaching production unchanged.
