import "server-only";

import { z } from "zod";
import { ACQUISITION_CHANNELS } from "@/lib/beta-acquisition";
import { createAdminClient } from "@/lib/supabase/admin";
import { INTEREST_OPTIONS } from "@/lib/beta-events";
import { SUPPORT_CATEGORIES, type BetaSignupProfile } from "./shared";

export type { BetaSignupProfile } from "./shared";
export { SUPPORT_CATEGORIES } from "./shared";

/**
 * Pre-auth lead capture + preference store for the beta landing page (`/` when
 * signed out) — not to be confused with `domains/waitlist`, which is a
 * signed-in user joining a specific event's ticket waitlist.
 *
 * All reads/writes go through the service-role client: `beta_signups` and its
 * sibling tables are PII write-only from the client (see migrations 0009/0010).
 */

export const betaSignupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .max(320)
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine(
      (value) => value === "" || value.replace(/\D/g, "").length >= 7,
      "Enter a valid phone number.",
    )
    .default(""),
  intent: z.enum(["buy", "sell", "both"], { message: "Choose an option." }),
  interestedEvents: z.array(z.string().trim().min(1)).max(10).default([]),
  interestedOther: z.string().trim().max(120).optional(),
  priority: z.enum(["speed", "profit", "both"], { message: "Choose an option." }),
  school: z.string().trim().max(160).optional(),
  referralSource: z.string().trim().max(160).optional(),
  notifyOptIn: z.boolean().default(false),
  /** First-touch from `?src=` / bare URL cookie — not the questionnaire field. */
  acquisitionChannel: z.enum(ACQUISITION_CHANNELS).optional(),
});

export type BetaSignupInput = z.infer<typeof betaSignupSchema>;

export type BetaSignupResult = { ok: true; id: string } | { ok: false; error: string };

export const contactUpdateSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .max(320)
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine(
      (value) => value === "" || value.replace(/\D/g, "").length >= 7,
      "Enter a valid phone number.",
    )
    .default(""),
});

export const notificationPrefsSchema = z.object({
  notifyQueueEmail: z.boolean(),
  notifyQueueSms: z.boolean(),
  notifyTicketsEmail: z.boolean(),
  notifyTicketsSms: z.boolean(),
});

export const eventInterestSchema = z.object({
  eventSlug: z.string().trim().min(1).max(80),
  intent: z.enum(["waitlist", "sell"]),
  active: z.boolean(),
});

export const eventRequestSchema = z.object({
  name: z.string().trim().min(1, "Enter an event name.").max(160),
  details: z.string().trim().max(500).optional(),
});

export const supportMessageSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .max(320)
    .transform((value) => value.toLowerCase()),
  category: z.enum(
    SUPPORT_CATEGORIES.map((c) => c.value) as [
      (typeof SUPPORT_CATEGORIES)[number]["value"],
      ...(typeof SUPPORT_CATEGORIES)[number]["value"][],
    ],
    { message: "Pick a category." },
  ),
  message: z.string().trim().min(10, "Tell us a bit more (at least a sentence).").max(2000),
});

const KNOWN_INTEREST_SLUGS = new Set<string>(INTEREST_OPTIONS.map((o) => o.value));

/**
 * Plain insert via service role so we can return the row id (anon has no
 * SELECT privilege — see 0009). A resubmit from the same email hits the unique
 * constraint; we treat that as idempotent success and look up the existing id.
 */
export async function submitBetaSignup(input: BetaSignupInput): Promise<BetaSignupResult> {
  const admin = createAdminClient();

  const smsOn = input.notifyOptIn;

  const { data, error } = await admin
    .from("beta_signups")
    .insert({
      name: input.name,
      email: input.email,
      phone: input.phone,
      intent: input.intent,
      interested_events: input.interestedEvents,
      interested_other: input.interestedOther || null,
      priority: input.priority,
      school: input.school || null,
      referral_source: input.referralSource || null,
      acquisition_channel: input.acquisitionChannel ?? null,
      notify_opt_in: input.notifyOptIn,
      notify_queue_email: true,
      notify_queue_sms: smsOn,
      notify_tickets_email: true,
      notify_tickets_sms: smsOn,
    })
    .select("id")
    .single();

  let signupId: string | null = data?.id ?? null;

  if (error) {
    if (error.code !== "23505") {
      return { ok: false, error: "Something went wrong. Try again in a moment." };
    }
    // Email already signed up — restore id, but do not overwrite first-touch channel.
    const { data: existing, error: lookupError } = await admin
      .from("beta_signups")
      .select("id")
      .eq("email", input.email)
      .maybeSingle();
    if (lookupError || !existing) {
      return { ok: false, error: "Something went wrong. Try again in a moment." };
    }
    signupId = existing.id;
  }

  if (!signupId) return { ok: false, error: "Something went wrong. Try again in a moment." };

  // Seed questionnaire picks as waitlist interest for known supported slugs.
  const seedSlugs = input.interestedEvents.filter((slug) => KNOWN_INTEREST_SLUGS.has(slug));
  if (seedSlugs.length > 0) {
    await admin.from("beta_event_interests").upsert(
      seedSlugs.map((event_slug) => ({
        signup_id: signupId,
        event_slug,
        intent: "waitlist" as const,
      })),
      { onConflict: "signup_id,event_slug,intent", ignoreDuplicates: true },
    );
  }

  return { ok: true, id: signupId };
}

/** Look up an existing beta signup by email so a returning visitor can restore their cookie. */
export async function findBetaSignupIdByEmail(
  email: string,
): Promise<{ ok: true; id: string } | { ok: true; id: null } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false, error: "Enter a valid email." };

  const { data, error } = await admin
    .from("beta_signups")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Something went wrong. Try again in a moment." };
  }
  return { ok: true, id: data?.id ?? null };
}

export async function getBetaSignupProfile(signupId: string): Promise<BetaSignupProfile | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("beta_signups")
    .select(
      "id, name, email, phone, notify_queue_email, notify_queue_sms, notify_tickets_email, notify_tickets_sms",
    )
    .eq("id", signupId)
    .maybeSingle();

  if (error || !data) return null;

  const { data: interests } = await admin
    .from("beta_event_interests")
    .select("event_slug, intent")
    .eq("signup_id", signupId);

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    notifyQueueEmail: data.notify_queue_email,
    notifyQueueSms: data.notify_queue_sms,
    notifyTicketsEmail: data.notify_tickets_email,
    notifyTicketsSms: data.notify_tickets_sms,
    interests: (interests ?? []).map((row) => ({
      eventSlug: row.event_slug,
      intent: row.intent as "waitlist" | "sell",
    })),
  };
}

export async function updateBetaContact(
  signupId: string,
  input: z.infer<typeof contactUpdateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("beta_signups")
    .update({ email: input.email, phone: input.phone })
    .eq("id", signupId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That email is already on the list under another signup." };
    }
    return { ok: false, error: "Couldn't update your contact info. Try again." };
  }
  return { ok: true };
}

export async function updateBetaNotificationPrefs(
  signupId: string,
  input: z.infer<typeof notificationPrefsSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_signups")
    .update({
      notify_queue_email: input.notifyQueueEmail,
      notify_queue_sms: input.notifyQueueSms,
      notify_tickets_email: input.notifyTicketsEmail,
      notify_tickets_sms: input.notifyTicketsSms,
      // Keep the original opt-in flag in sync with any SMS channel being on.
      notify_opt_in: input.notifyQueueSms || input.notifyTicketsSms,
    })
    .eq("id", signupId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "beta_prefs_update_failed",
        signupId,
        error: error.message,
        code: error.code,
      }),
    );
    // Most common local miss: migration 0010 not applied yet.
    if (/notify_queue_|notify_tickets_/i.test(error.message)) {
      return {
        ok: false,
        error: "Preference columns aren't in the database yet. Apply migration 0010_beta_preferences.sql.",
      };
    }
    return { ok: false, error: "Couldn't save notification preferences. Try again." };
  }
  if (!data) {
    return { ok: false, error: "We couldn't find your signup. Rejoin the waitlist from the home page." };
  }
  return { ok: true };
}

export async function setBetaEventInterest(
  signupId: string,
  input: z.infer<typeof eventInterestSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  if (input.active) {
    const { error } = await admin.from("beta_event_interests").upsert(
      {
        signup_id: signupId,
        event_slug: input.eventSlug,
        intent: input.intent,
      },
      { onConflict: "signup_id,event_slug,intent", ignoreDuplicates: true },
    );
    if (error) return { ok: false, error: "Couldn't save that. Try again." };
  } else {
    const { error } = await admin
      .from("beta_event_interests")
      .delete()
      .eq("signup_id", signupId)
      .eq("event_slug", input.eventSlug)
      .eq("intent", input.intent);
    if (error) return { ok: false, error: "Couldn't update that. Try again." };
  }

  return { ok: true };
}

export async function submitBetaEventRequest(
  signupId: string | null,
  input: z.infer<typeof eventRequestSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("beta_event_requests").insert({
    signup_id: signupId,
    name: input.name,
    details: input.details || null,
  });
  if (error) return { ok: false, error: "Couldn't send that request. Try again." };
  return { ok: true };
}

export async function submitBetaSupportMessage(
  signupId: string | null,
  input: z.infer<typeof supportMessageSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("beta_support_messages").insert({
    signup_id: signupId,
    email: input.email,
    category: input.category,
    message: input.message,
  });
  if (error) return { ok: false, error: "Couldn't send your message. Try again." };

  // Soft delivery: structured log so ops can alert on insert until an email
  // provider is wired. Prefer failing open on delivery — the row is the record.
  console.info(
    JSON.stringify({
      level: "info",
      msg: "beta_support_message",
      category: input.category,
      email: input.email,
      signupId,
    }),
  );

  return { ok: true };
}
