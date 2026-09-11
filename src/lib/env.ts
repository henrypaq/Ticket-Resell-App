/**
 * Twelve-factor config (ARCHITECTURE.md § configuration). Nothing here is
 * hardcoded and nothing is committed — values come from .env.local.
 *
 * .env.local carries the raw Supabase names (SUPABASE_PROJECT_URL etc.); Next
 * only exposes NEXT_PUBLIC_-prefixed vars to the browser, so the public pair is
 * aliased there. SUPABASE_PROJECT_KEY (the secret key) is deliberately not
 * aliased and must never be imported from a client component.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Check .env.local — see README.md § environment.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_PROJECT_URL,
);

export const SUPABASE_PUBLISHABLE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY,
);

/** Server-only. Bypasses RLS — never expose this to the client bundle. */
export function supabaseSecretKey(): string {
  return required("SUPABASE_PROJECT_KEY", process.env.SUPABASE_PROJECT_KEY);
}

/**
 * Development-only demo sign-in.
 *
 * Deliberately NOT a NEXT_PUBLIC_ variable: it is read on the server only, both
 * to decide whether the button renders and to authorise the action itself. A
 * client-readable flag would put a security-relevant switch in the browser
 * bundle, which SECURITY.md lists as a non-negotiable violation.
 *
 * Fails closed: anything other than an explicit "true" outside production
 * disables it.
 */
export function demoLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEMO_LOGIN === "true";
}

export function demoLoginEmail(): string {
  return process.env.DEMO_LOGIN_EMAIL || "demo@passe.local";
}

/**
 * Stripe.
 *
 * Payments are wired end to end but stay inert until real keys land in
 * .env.local. Every entry point checks this first and returns a readable
 * "payments aren't configured" rather than throwing — a missing key must not
 * take down the rest of the app, and it must never produce a Transaction row
 * that claims money moved when it didn't.
 */
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

export function stripeSecretKey(): string {
  return required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY);
}

export function stripePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}

export function stripeWebhookSecret(): string {
  return required("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Guards the auto-release cron endpoint (Phase 2's Tier B timeout — see
 * domains/payments/auto-release.ts). Vercel Cron automatically sends
 * `Authorization: Bearer $CRON_SECRET` on invocation once this env var is set;
 * unset it locally and the endpoint fails closed with 503 rather than moving
 * money off an unauthenticated request.
 */
export function cronSecret(): string | null {
  return process.env.CRON_SECRET || null;
}

/**
 * Resend email (admin alerts for beta waitlist / sell interest).
 * Inert until `RESEND_API_KEY` is set — missing config must not break saves.
 */
export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function resendApiKey(): string {
  return required("RESEND_API_KEY", process.env.RESEND_API_KEY);
}

/**
 * From address. Until you verify a domain in Resend, use their test sender:
 * `McGill Tickets <onboarding@resend.dev>` (can only deliver to your Resend
 * account email). After verifying mcgilltickets.party, set e.g.
 * `mcgill.tickets alerts <alerts@mcgilltickets.party>`.
 */
export function resendFromEmail(): string {
  return (
    process.env.RESEND_FROM_EMAIL ||
    "mcgill.tickets alerts <onboarding@resend.dev>"
  );
}

/** Comma-separated admin inboxes for beta interest alerts. */
export function adminAlertEmails(): string[] {
  const raw = process.env.ADMIN_ALERT_EMAIL ?? "wrymage@gmail.com";
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

/**
 * Twilio SMS — optional later; admin alerts currently go through Resend email.
 */
export function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER &&
      process.env.ADMIN_SMS_TO,
  );
}

export function twilioAccountSid(): string {
  return required("TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID);
}

export function twilioAuthToken(): string {
  return required("TWILIO_AUTH_TOKEN", process.env.TWILIO_AUTH_TOKEN);
}

/** E.164 Twilio number or Messaging Service sender, e.g. +15145551234. */
export function twilioFromNumber(): string {
  return required("TWILIO_FROM_NUMBER", process.env.TWILIO_FROM_NUMBER);
}

/** Comma-separated E.164 admin phones that receive beta interest alerts. */
export function adminSmsRecipients(): string[] {
  const raw = process.env.ADMIN_SMS_TO ?? "";
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}
