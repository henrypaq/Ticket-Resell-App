/**
 * Notify a waitlist seat or seller about an offer lifecycle event.
 * Soft-fail: never throws into the matching path.
 *
 * Email only for now — SMS helpers stay in the codebase but are not called.
 */

import "server-only";

import { sendEmail } from "@/lib/email/resend";
import {
  eventRequestReceivedEmail,
  lifecycleEmail,
  type LifecycleNotifyKind,
} from "@/lib/email/user-notification-templates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BetaEvent } from "@/lib/beta-events";

export type OfferNotifyKind = LifecycleNotifyKind;

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "") ||
    "https://mcgilltickets.party"
  );
}

function offerUrl(offerId: string): string {
  return `${siteOrigin()}/offer/${offerId}`;
}

function payoutConfirmUrl(offerId: string): string {
  return `${siteOrigin()}/payout/confirm?offer=${encodeURIComponent(offerId)}`;
}

const DAY_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

/** Human day/schedule line for email event cards. */
export function betaEventDayLabel(event: BetaEvent): string {
  if (event.days.length === 1) return event.days[0]!;
  if (event.days.length > 1) {
    const first = DAY_ABBR[event.days[0]!] ?? event.days[0]!;
    const last = DAY_ABBR[event.days[event.days.length - 1]!] ?? event.days[event.days.length - 1]!;
    return `${first}–${last}`;
  }
  if (event.extraDateKeys?.length) {
    const key = event.extraDateKeys[0]!;
    const [y, m, d] = key.split("-").map(Number);
    if (y && m && d) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    }
  }
  return event.venue;
}

export function absoluteFlyerUrl(
  flyerUrl: string | null | undefined,
  origin: string = siteOrigin(),
): string | null {
  if (!flyerUrl?.trim()) return null;
  const raw = flyerUrl.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${origin}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

async function resolveContact(seatKey: string): Promise<{
  phone: string | null;
  email: string | null;
  eventSlug: string | null;
}> {
  const admin = createAdminClient();
  if (seatKey.startsWith("go:")) {
    const id = seatKey.slice(3);
    const { data } = await admin
      .from("beta_go_leads")
      .select("contact_phone, transfer_email, event_slug, contact_id")
      .eq("id", id)
      .maybeSingle();
    let email = (data?.transfer_email as string | null) ?? null;
    if (!email && data?.contact_id) {
      const { data: c } = await admin
        .from("beta_go_contacts")
        .select("etransfer_email")
        .eq("id", data.contact_id)
        .maybeSingle();
      email = c?.etransfer_email ?? null;
    }
    return {
      phone: (data?.contact_phone as string | null) ?? null,
      email,
      eventSlug: (data?.event_slug as string | null) ?? null,
    };
  }
  if (seatKey.startsWith("classic:")) {
    const id = seatKey.slice(8);
    const { data } = await admin
      .from("beta_member_interests")
      .select("event_slug, member_id")
      .eq("id", id)
      .maybeSingle();
    if (!data?.member_id) {
      return { phone: null, email: null, eventSlug: data?.event_slug ?? null };
    }
    const { data: member } = await admin
      .from("beta_members")
      .select("email, phone, notify_tickets_email")
      .eq("id", data.member_id)
      .maybeSingle();
    return {
      phone: null,
      email: member?.notify_tickets_email === false ? null : (member?.email ?? null),
      eventSlug: data.event_slug,
    };
  }
  return { phone: null, email: null, eventSlug: null };
}

async function resolveSellLeadContact(sellLeadId: string): Promise<{
  phone: string | null;
  email: string | null;
  eventSlug: string | null;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("beta_go_leads")
    .select("contact_phone, etransfer_email, event_slug, contact_id, etransfer_phone")
    .eq("id", sellLeadId)
    .maybeSingle();
  if (!data) return { phone: null, email: null, eventSlug: null };

  let email = (data.etransfer_email as string | null) ?? null;
  if (!email && data.contact_id) {
    const { data: c } = await admin
      .from("beta_go_contacts")
      .select("etransfer_email")
      .eq("id", data.contact_id)
      .maybeSingle();
    email = c?.etransfer_email || null;
  }
  return {
    phone: null,
    email,
    eventSlug: (data.event_slug as string | null) ?? null,
  };
}

async function resolveBuyLeadContact(buyLeadId: string): Promise<{
  email: string | null;
  eventSlug: string | null;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("beta_go_leads")
    .select("transfer_email, event_slug, contact_id")
    .eq("id", buyLeadId)
    .maybeSingle();
  if (!data) return { email: null, eventSlug: null };
  let email = (data.transfer_email as string | null) ?? null;
  if (!email && data.contact_id) {
    const { data: c } = await admin
      .from("beta_go_contacts")
      .select("etransfer_email")
      .eq("id", data.contact_id)
      .maybeSingle();
    email = c?.etransfer_email ?? null;
  }
  return { email, eventSlug: (data.event_slug as string | null) ?? null };
}

async function sendNotify(
  kind: OfferNotifyKind,
  contact: { email: string | null; eventSlug: string | null },
  args: {
    priceEach: number;
    offerId?: string;
    eventSlug?: string;
    deadlineIso?: string | null;
    quantity?: number;
  },
): Promise<void> {
  if (!contact.email) return;

  const slug = args.eventSlug ?? contact.eventSlug ?? "";
  const origin = siteOrigin();
  const { getBetaEventBySlug } = await import("@/domains/beta-events/catalog");
  const event = slug ? await getBetaEventBySlug(slug) : undefined;
  const eventName = event?.name ?? (slug || "your event");
  const deadline = args.deadlineIso
    ? new Date(args.deadlineIso).toLocaleString("en-CA", {
        timeZone: "America/Toronto",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : undefined;

  const { platformTicketTransfer } = await import("@/lib/env");
  const custody = slug === "cafe-campus" ? platformTicketTransfer() : null;

  const copy = lifecycleEmail(kind, {
    eventName,
    price: args.priceEach,
    offerId: args.offerId,
    deadline,
    eventSlug: slug,
    transferName: custody?.name,
    transferEmail: custody?.email,
    quantity: args.quantity,
    appUrl: origin,
    offerUrl: args.offerId ? offerUrl(args.offerId) : undefined,
    payoutConfirmUrl: args.offerId ? payoutConfirmUrl(args.offerId) : undefined,
    flyerUrl: event ? absoluteFlyerUrl(event.flyerUrl, origin) : null,
    eventDay: event ? betaEventDayLabel(event) : null,
    eventCity: event?.city ?? null,
  });

  // SMS intentionally off until Twilio is productized.
  await sendEmail({
    to: contact.email,
    subject: copy.subject,
    text: copy.text,
    html: copy.html,
  });
}

export async function notifyOfferSeat(args: {
  kind: OfferNotifyKind;
  seatKey: string;
  priceEach: number;
  offerId?: string;
  eventSlug?: string;
  deadlineIso?: string | null;
}): Promise<void> {
  try {
    const contact = await resolveContact(args.seatKey);
    await sendNotify(args.kind, contact, args);
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "offer_notify_failed",
        kind: args.kind,
        seatKey: args.seatKey,
        error: String(err),
      }),
    );
  }
}

export async function notifySellLead(args: {
  kind:
    | "seller_listed"
    | "seller_sale_paid"
    | "seller_ticket_received"
    | "seller_payout_released";
  sellLeadId: string;
  priceEach: number;
  offerId?: string;
  eventSlug?: string;
  quantity?: number;
}): Promise<void> {
  try {
    const contact = await resolveSellLeadContact(args.sellLeadId);
    await sendNotify(args.kind, contact, args);
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "seller_notify_failed",
        kind: args.kind,
        sellLeadId: args.sellLeadId,
        error: String(err),
      }),
    );
  }
}

export async function notifyBuyLead(args: {
  kind: "waitlist_joined";
  buyLeadId: string;
  eventSlug?: string;
}): Promise<void> {
  try {
    const contact = await resolveBuyLeadContact(args.buyLeadId);
    await sendNotify(args.kind, contact, {
      priceEach: 0,
      eventSlug: args.eventSlug ?? contact.eventSlug ?? undefined,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "buyer_notify_failed",
        kind: args.kind,
        buyLeadId: args.buyLeadId,
        error: String(err),
      }),
    );
  }
}

/** Soft-fail confirmation when someone requests an unsupported event. */
export async function notifyUserEventRequestReceived(args: {
  to: string;
  eventNameRequested: string;
  details?: string | null;
}): Promise<void> {
  const email = args.to.trim().toLowerCase();
  if (!email || !email.includes("@")) return;

  try {
    const origin = siteOrigin();
    const copy = eventRequestReceivedEmail({
      eventNameRequested: args.eventNameRequested,
      details: args.details,
      appUrl: origin,
    });
    const result = await sendEmail({
      to: email,
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
    });
    if (!result.ok && !result.skipped) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "event_request_email_failed",
          error: result.error,
        }),
      );
    }
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "event_request_email_failed",
        error: String(err),
      }),
    );
  }
}
