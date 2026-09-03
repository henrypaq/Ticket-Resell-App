"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  demoLoginEmail,
  demoLoginEnabled,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/lib/env";
import { logEvent } from "@/lib/analytics/log";
import { sanitizeNextPath } from "@/lib/next-path";

/**
 * Email OTP only — no passwords in v1 (SECURITY.md). Signup is open to any
 * address; the OTP round-trip is what proves the address is real and reachable,
 * rather than gating on a domain allow-list.
 */
const emailSchema = z.object({ email: z.string().email("Enter a valid email address.") });
const verifySchema = z.object({
  email: z.string().email(),
  token: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
});

export type AuthState = { error?: string; sent?: boolean; email?: string };

export async function requestCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailSchema.safeParse({ email: String(formData.get("email") ?? "").trim() });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    // Supabase's own per-email/per-IP throttle. SECURITY.md wants OTP requests
    // rate limited; this surfaces that limit rather than hiding it.
    return { error: error.message, email: parsed.data.email };
  }

  return { sent: true, email: parsed.data.email };
}

export async function verifyCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = verifySchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    token: String(formData.get("token") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, sent: true, email: String(formData.get("email") ?? "") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error) {
    return { error: "That code didn't work. Check it or request a new one.", sent: true, email: parsed.data.email };
  }

  if (data.user) {
    const isNew =
      data.user.created_at &&
      Date.now() - new Date(data.user.created_at).getTime() < 60_000;
    await logEvent({
      type: isNew ? "signup_completed" : "login",
      userId: data.user.id,
      metadata: { method: "email_otp" },
    });
  }

  redirect(sanitizeNextPath(String(formData.get("next") ?? "")) ?? "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * One-tap demo sign-in — development only.
 *
 * This is a real Supabase session, not a forged one: it mints a single-use
 * magic-link token with the service role and immediately redeems it through the
 * normal verifyOtp path, so cookies, session refresh, and RLS all behave
 * exactly as they do for a real user. What it skips is the email round-trip.
 *
 * The guard is server-side and fails closed. It is checked here as well as in
 * the page that renders the button, so hiding the button is never what enforces
 * it (SECURITY.md § non-negotiables).
 */
export async function demoSignIn(nextPath?: string): Promise<AuthState> {
  if (!demoLoginEnabled()) {
    return { error: "Demo sign-in is disabled." };
  }

  const email = demoLoginEmail();
  const admin = createAdminClient();

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !link.properties?.hashed_token) {
    return { error: linkError?.message ?? "Could not start the demo session." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await logEvent({ type: "login", userId: data.user.id, metadata: { method: "demo" } });
  }

  redirect(sanitizeNextPath(nextPath) ?? "/");
}

/**
 * Is the Google provider actually turned on for this project?
 *
 * signInWithOAuth builds the authorize URL locally without calling Supabase, so
 * a disabled provider is not caught there — the browser would just land on a
 * raw 400 from /auth/v1/authorize. Checking the public settings endpoint first
 * turns that dead end into a readable message.
 */
async function googleProviderEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      // Provider config changes rarely; a short cache keeps this off the hot path.
      next: { revalidate: 60 },
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return Boolean(settings.external?.google);
  } catch {
    return false;
  }
}

/**
 * Google OAuth. Returns the provider URL for the browser to follow rather than
 * redirecting server-side, so the PKCE verifier cookie is written first.
 */
export async function startGoogleSignIn(
  origin: string,
  nextPath?: string,
): Promise<{ url?: string; error?: string }> {
  if (!(await googleProviderEnabled())) {
    return {
      error:
        "Google sign-in isn't enabled on this Supabase project yet. Add a Google OAuth client under Authentication → Providers, then this button works with no code change.",
    };
  }

  const supabase = await createClient();
  const safeNext = sanitizeNextPath(nextPath);
  const redirectTo = safeNext
    ? `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
    : `${origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error) {
    return { error: `Google sign-in isn't available yet: ${error.message}` };
  }
  if (!data.url) {
    return { error: "Google sign-in isn't enabled on this Supabase project yet." };
  }

  return { url: data.url };
}
