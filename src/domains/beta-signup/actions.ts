"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  BETA_ACQUISITION_COOKIE,
  BETA_LAST_SRC_COOKIE,
  isAcquisitionChannel,
  type AcquisitionChannel,
} from "@/lib/beta-acquisition";
import { GO_CONTACT_COOKIE } from "@/domains/beta-go/shared";
import { adoptGoContactForMember, linkMemberToGoHistory } from "@/domains/beta-go/contacts";
import {
  QUICK_BUYER_COOKIE,
  QUICK_DRAFT_COOKIE,
  QUICK_SELLER_COOKIE,
} from "@/domains/beta-quick/shared";
import { demoLoginEnabled } from "@/lib/env";
import {
  betaSignupSchema,
  contactUpdateSchema,
  findBetaSignupIdByEmail,
  getBetaSignupProfile,
  notificationPrefsSchema,
  submitBetaSignup,
  submitBetaSupportMessage,
  supportMessageSchema,
  updateBetaContact,
  updateBetaNotificationPrefs,
  type BetaSignupProfile,
} from "./service";

export type BetaSignupState = { error?: string; field?: string; ok?: boolean };
export type BetaActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
  waitlistPosition?: number;
};
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
 * There's no account behind this flow, so membership is a cookie holding the
 * `beta_members.id`. Not a session — just enough to load/update prefs without
 * re-collecting PII on every visit. Only a real uuid that still resolves to a
 * live member counts — a stale or deleted id simply reads as "no profile
 * saved", which is a perfectly normal state now that nothing is gated.
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

/**
 * Save-your-profile, offered at the end of a buy/sell flow instead of gating
 * the front door. Everything the questionnaire used to ask that we can infer,
 * we infer: `intent` from the flow they just finished, `referralSource` from
 * the link they arrived on. What's left is name and email.
 *
 * Note what is NOT passed through: `interestedEvents`. `submitBetaSignup`
 * seeds those into `beta_member_interests`, which is a seat in the same queue
 * as the buy lead they just created (`listUnifiedQueueSeats`) — passing the
 * event here would put one person in line twice. The event goes into
 * `interestedOther` as context instead, which holds no seat.
 */
export async function saveProfileAction(
  _prev: BetaActionState,
  formData: FormData,
): Promise<BetaActionState> {
  const intentRaw = String(formData.get("intent") ?? "");
  const parsed = betaSignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
    intent: intentRaw === "buy" || intentRaw === "sell" ? intentRaw : "both",
    interestedEvents: [],
    interestedOther: formData.get("eventName") || undefined,
    priority: "both",
    school: undefined,
    referralSource: formData.get("referralSource") || undefined,
    notifyOptIn: formData.get("notifyOptIn") === "on",
    acquisitionChannel: await readAcquisitionChannel(),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check your details and try again." };
  }

  // Knowing whether the email is already ours only changes the message —
  // `submitBetaSignup` resolves the duplicate either way rather than failing.
  const existing = await findBetaSignupIdByEmail(parsed.data.email);
  const returning = existing.ok && Boolean(existing.id);

  const result = await submitBetaSignup(parsed.data);
  if (!result.ok) return { error: result.error };

  await setSignupCookie(result.id);

  // `submitBetaSignup` links prior /go history by phone and email. That misses
  // an Instagram-only lead, which has neither — so attach this device's
  // contact directly. Without it, the listing they posted sixty seconds ago
  // disappears from home the moment they save a profile.
  const cookieStore = await cookies();
  const contactId = cookieStore.get(GO_CONTACT_COOKIE)?.value;
  if (contactId && UUID_RE.test(contactId)) {
    await adoptGoContactForMember({ contactId, memberId: result.id, force: true });
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return {
    ok: true,
    message: returning
      ? "Welcome back — this device is linked to your profile again."
      : "Saved. Your tickets and waitlist spots will follow you from now on.",
  };
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
  // Their /go leads may predate the member row on this device — attach them now
  // so the home page shows the waitlists and listings they already have.
  await linkMemberToGoHistory({ memberId: found.id, email: parsed.data });
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, resumed: true };
}

/**
 * Clears beta browser state (signup cookie + /go contact + waitlist cookie)
 * so this device can run the questionnaire / /go flows as a new visitor.
 * Safe to expose — equivalent to clearing site cookies manually.
 */
export async function clearBetaBrowserStateAction(): Promise<BetaActionState> {
  const cookieStore = await cookies();
  cookieStore.delete(BETA_SIGNUP_COOKIE);
  cookieStore.delete(GO_CONTACT_COOKIE);
  cookieStore.delete(QUICK_BUYER_COOKIE);
  cookieStore.delete(QUICK_SELLER_COOKIE);
  cookieStore.delete(QUICK_DRAFT_COOKIE);
  cookieStore.delete(BETA_ACQUISITION_COOKIE);
  cookieStore.delete(BETA_LAST_SRC_COOKIE);
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, message: "Cleared. You’re a new visitor on this device." };
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
  return clearBetaBrowserStateAction();
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
  if (!id) return { error: "We couldn't find your signup. Rejoin from the home page." };

  const parsed = contactUpdateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid contact info." };
  }

  const result = await updateBetaContact(id, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, message: "Your info is saved." };
}

export async function updateBetaNotificationPrefsAction(
  _prev: BetaActionState,
  formData: FormData,
): Promise<BetaActionState> {
  const id = await getBetaSignupId();
  if (!id) return { error: "We couldn't find your signup. Rejoin from the home page." };

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
  revalidatePath("/settings");
  return { ok: true, message: "Saved." };
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
