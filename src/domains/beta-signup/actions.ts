"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  BETA_ACQUISITION_COOKIE,
  isAcquisitionChannel,
  type AcquisitionChannel,
} from "@/lib/beta-acquisition";
import { demoLoginEnabled } from "@/lib/env";
import {
  betaSignupSchema,
  contactUpdateSchema,
  eventInterestSchema,
  eventRequestSchema,
  findBetaSignupIdByEmail,
  getBetaSignupProfile,
  notificationPrefsSchema,
  setBetaEventInterest,
  submitBetaEventRequest,
  submitBetaSignup,
  submitBetaSupportMessage,
  supportMessageSchema,
  updateBetaContact,
  updateBetaNotificationPrefs,
  type BetaSignupProfile,
} from "./service";

export type BetaSignupState = { error?: string; field?: string; ok?: boolean };
export type BetaActionState = { error?: string; ok?: boolean; message?: string };
export type BetaResumeState =
  | { ok: true; resumed: true }
  | { ok: true; resumed: false }
  | { ok: false; error: string };

const BETA_SIGNUP_COOKIE = "passe_beta_signup";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COOKIE_BASE = {
  maxAge: 60 * 60 * 24 * 365,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

async function setSignupCookie(id: string) {
  const cookieStore = await cookies();
  cookieStore.set(BETA_SIGNUP_COOKIE, id, COOKIE_BASE);
}

async function readAcquisitionChannel(): Promise<AcquisitionChannel> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(BETA_ACQUISITION_COOKIE)?.value;
  if (isAcquisitionChannel(existing)) return existing;
  return "ig_bio";
}

/**
 * There's no account behind this flow, so "once you've signed up" is tracked
 * with a cookie holding the `beta_signups.id`. Not a session — just enough to
 * load/update prefs without re-collecting PII on every visit. Legacy value
 * `"1"` (from the flag-only cookie) still counts as completed for the gate,
 * but preference actions need a real uuid.
 */
export async function submitBetaSignupAction(
  _prev: BetaSignupState,
  formData: FormData,
): Promise<BetaSignupState> {
  const parsed = betaSignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
    intent: formData.get("intent"),
    interestedEvents: formData.getAll("interestedEvents"),
    interestedOther: formData.get("interestedOther") || undefined,
    priority: formData.get("priority"),
    school: formData.get("school") || undefined,
    referralSource: formData.get("referralSource") || undefined,
    notifyOptIn: formData.get("notifyOptIn") === "on",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0] ?? "") };
  }

  const result = await submitBetaSignup({
    ...parsed.data,
    acquisitionChannel: await readAcquisitionChannel(),
  });
  if (!result.ok) return { error: result.error };

  await setSignupCookie(result.id);
  return { ok: true };
}

const zEmail = betaSignupSchema.shape.email;

/**
 * Returning-visitor path: email alone restores the signup cookie and lands them
 * back on the beta shell. Intentionally weak auth (knowing the email is enough)
 * — acceptable for beta preference recovery, not for anything money-moving.
 */
export async function resumeBetaSignupByEmailAction(email: string): Promise<BetaResumeState> {
  const parsed = zEmail.safeParse(email);
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };

  const found = await findBetaSignupIdByEmail(parsed.data);
  if (!found.ok) return { ok: false, error: found.error };
  if (!found.id) return { ok: true, resumed: false };

  await setSignupCookie(found.id);
  revalidatePath("/");
  return { ok: true, resumed: true };
}

/**
 * Dev-only shortcut: skip the questionnaire and land straight on the beta
 * shell with a throwaway placeholder signup. Gated by the same
 * `ENABLE_DEMO_LOGIN` flag as the demo sign-in button (README § known gaps) —
 * checked here, server-side, not just in whether the button is rendered, so
 * hiding the button is never what enforces it.
 */
export async function skipBetaSignupAction(): Promise<BetaSignupState> {
  if (!demoLoginEnabled()) {
    return { error: "Preview skip is disabled outside development." };
  }

  const result = await submitBetaSignup({
    name: "Preview",
    email: `preview+${Date.now()}@passe.local`,
    phone: "5145550100",
    intent: "both",
    interestedEvents: ["cafe-campus"],
    interestedOther: undefined,
    priority: "both",
    school: undefined,
    referralSource: "dev skip button",
    notifyOptIn: true,
    acquisitionChannel: await readAcquisitionChannel(),
  });
  if (!result.ok) return { error: result.error };

  await setSignupCookie(result.id);
  return { ok: true };
}

/**
 * Dev-only shortcut: clear the signup cookie so `/` falls back to the
 * questionnaire — the reverse of `skipBetaSignupAction`. Doesn't delete the
 * underlying row; just forgets which one this browser is looking at. Same
 * fail-closed gate as the skip button.
 */
export async function resetBetaSignupAction(): Promise<BetaActionState> {
  if (!demoLoginEnabled()) {
    return { error: "Preview reset is disabled outside development." };
  }

  const cookieStore = await cookies();
  cookieStore.delete(BETA_SIGNUP_COOKIE);
  return { ok: true };
}

export async function hasCompletedBetaSignup(): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(BETA_SIGNUP_COOKIE)?.value;
  return Boolean(value);
}

export async function getBetaSignupId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(BETA_SIGNUP_COOKIE)?.value;
  if (!value || !UUID_RE.test(value)) return null;
  return value;
}

export async function loadBetaProfile(): Promise<BetaSignupProfile | null> {
  const id = await getBetaSignupId();
  if (!id) return null;
  return getBetaSignupProfile(id);
}

export async function updateBetaContactAction(
  _prev: BetaActionState,
  formData: FormData,
): Promise<BetaActionState> {
  const id = await getBetaSignupId();
  if (!id) return { error: "We couldn't find your signup. Rejoin the waitlist from the home page." };

  const parsed = contactUpdateSchema.safeParse({
    email: formData.get("email"),
    phone: formData.get("phone") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid contact info." };
  }

  const result = await updateBetaContact(id, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/");
  return { ok: true, message: "Contact info saved." };
}

export async function updateBetaNotificationPrefsAction(
  _prev: BetaActionState,
  formData: FormData,
): Promise<BetaActionState> {
  const id = await getBetaSignupId();
  if (!id) return { error: "We couldn't find your signup. Rejoin the waitlist from the home page." };

  const parsed = notificationPrefsSchema.safeParse({
    notifyQueueEmail: formData.get("notifyQueueEmail") === "on",
    notifyQueueSms: formData.get("notifyQueueSms") === "on",
    notifyTicketsEmail: formData.get("notifyTicketsEmail") === "on",
    notifyTicketsSms: formData.get("notifyTicketsSms") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid preferences." };
  }

  const result = await updateBetaNotificationPrefs(id, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/");
  return { ok: true, message: "Saved." };
}

export async function setBetaEventInterestAction(
  _prev: BetaActionState,
  formData: FormData,
): Promise<BetaActionState> {
  const id = await getBetaSignupId();
  if (!id) return { error: "We couldn't find your signup. Rejoin the waitlist from the home page." };

  const parsed = eventInterestSchema.safeParse({
    eventSlug: formData.get("eventSlug"),
    intent: formData.get("intent"),
    active: formData.get("active") === "1",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const result = await setBetaEventInterest(id, parsed.data);
  if (!result.ok) return { error: result.error };
  return {
    ok: true,
    message:
      parsed.data.intent === "waitlist"
        ? parsed.data.active
          ? "You're on the waiting list for this event."
          : "Removed from the waiting list."
        : parsed.data.active
          ? "We'll reach out when you're ready to post this ticket."
          : "Cancelled sell interest.",
  };
}

export async function submitBetaEventRequestAction(
  _prev: BetaActionState,
  formData: FormData,
): Promise<BetaActionState> {
  const id = await getBetaSignupId();
  const parsed = eventRequestSchema.safeParse({
    name: formData.get("name"),
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const result = await submitBetaEventRequest(id, parsed.data);
  if (!result.ok) return { error: result.error };
  return {
    ok: true,
    message: "Request received — once we get enough requests we can support your event!",
  };
}

export async function submitBetaSupportAction(
  _prev: BetaActionState,
  formData: FormData,
): Promise<BetaActionState> {
  const id = await getBetaSignupId();
  const parsed = supportMessageSchema.safeParse({
    email: formData.get("email"),
    category: formData.get("category"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }

  const result = await submitBetaSupportMessage(id, parsed.data);
  if (!result.ok) return { error: result.error };
  return {
    ok: true,
    message: "Message sent. We'll get back to you within 2 business days.",
  };
}
