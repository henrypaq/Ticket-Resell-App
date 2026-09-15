/**
 * Notify a waitlist seat or seller about an offer lifecycle event.
 * Soft-fail: never throws into the matching path.
 */

import "server-only";

import { sendEmail } from "@/lib/email/resend";
import { sendSms } from "@/lib/twilio/sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { betaEventBySlug } from "@/lib/beta-events";

export type OfferNotifyKind =
  | "offered"
  | "reminder"
  | "expired"
  | "paid"
  | "next_up"
  | "reactivate"
  | "seller_sale_paid"
  | "seller_payout_released";

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

function copyFor(
  kind: OfferNotifyKind,
  args: { eventName: string; price: number; offerId?: string; deadline?: string },
): { sms: string; subject: string; text: string } {
  const link = args.offerId ? offerUrl(args.offerId) : siteOrigin();
  const home = siteOrigin();
  const price = `$${args.price.toFixed(2)}`;
  switch (kind) {
    case "offered":
      return {
        sms: `mcgill.tickets: A ticket for ${args.eventName} is yours at ${price} if you claim it${args.deadline ? ` by ${args.deadline}` : ""}. ${link} Reply STOP to opt out.`,
        subject: `Ticket ready — ${args.eventName}`,
        text: `A ticket for ${args.eventName} is being held for you at ${price}.${args.deadline ? ` Respond by ${args.deadline}.` : ""}\n\nClaim it, then you'll get Interac details on the next screen: ${link}\n\n— mcgill.tickets`,
      };
    case "reminder":
      return {
        sms: `mcgill.tickets: Reminder — your ${args.eventName} ticket hold is still open (${price}). ${link}`,
        subject: `Reminder: ${args.eventName} ticket hold`,
        text: `Your hold for ${args.eventName} at ${price} is still open.\n\n${link}\n\n— mcgill.tickets`,
      };
    case "expired":
      return {
        sms: `mcgill.tickets: Your hold for ${args.eventName} expired. You're still on the waitlist for a better match.`,
        subject: `Hold expired — ${args.eventName}`,
        text: `Your hold for ${args.eventName} expired. You're still on the waitlist — we'll ping you if another ticket fits.\n\n— mcgill.tickets`,
      };
    case "paid":
      return {
        sms: `mcgill.tickets: Payment confirmed for ${args.eventName}. We'll transfer the ticket shortly.`,
        subject: `Payment confirmed — ${args.eventName}`,
        text: `We confirmed your payment for ${args.eventName}. We'll transfer the ticket shortly.\n\nReceipt: ${link}\n\n— mcgill.tickets`,
      };
    case "next_up":
      return {
        sms: `mcgill.tickets: You're next for ${args.eventName} if the current hold falls through. Stay ready.`,
        subject: `You're next — ${args.eventName}`,
        text: `You're next in line for ${args.eventName} if the current hold falls through. No action needed yet.\n\n— mcgill.tickets`,
      };
    case "reactivate":
      return {
        sms: `mcgill.tickets: Welcome back — we'll hold tickets for you again on ${args.eventName}.`,
        subject: `Waitlist reactivated — ${args.eventName}`,
        text: `You're active on the ${args.eventName} waitlist again. We'll hold matching tickets for you.\n\n— mcgill.tickets`,
      };
    case "seller_sale_paid":
      return {
        sms: `mcgill.tickets: Your ${args.eventName} ticket sold at ${price}. Transfer it within 30 minutes — then we release your payout. ${home}`,
        subject: `Sold — transfer your ${args.eventName} ticket`,
        text: `A buyer paid ${price} for your ${args.eventName} ticket.\n\nPlease transfer the ticket within 30 minutes. Once we confirm the transfer, we release your Interac payout.\n\n${home}\n\n— mcgill.tickets`,
      };
    case "seller_payout_released":
      return {
        sms: `mcgill.tickets: Payment released for your ${args.eventName} sale (${price}). Check your Interac — payout is on the way.`,
        subject: `Payment released — ${args.eventName}`,
        text: `Your ${args.eventName} ticket transfer is confirmed. We've released your payout of ${price} via Interac to the details on your listing.\n\n${home}\n\n— mcgill.tickets`,
      };
  }
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
      .select("email, phone, notify_tickets_sms, notify_tickets_email")
      .eq("id", data.member_id)
      .maybeSingle();
    return {
      phone: member?.notify_tickets_sms ? (member.phone ?? null) : null,
      email: member?.notify_tickets_email ? (member.email ?? null) : null,
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
  let phone =
    (data.contact_phone as string | null) ||
    (data.etransfer_phone as string | null) ||
    null;
  if ((!email || !phone) && data.contact_id) {
    const { data: c } = await admin
      .from("beta_go_contacts")
      .select("etransfer_email, etransfer_phone, contact_phone")
      .eq("id", data.contact_id)
      .maybeSingle();
    email = email || c?.etransfer_email || null;
    phone = phone || c?.contact_phone || c?.etransfer_phone || null;
  }
  return {
    phone,
    email,
    eventSlug: (data.event_slug as string | null) ?? null,
  };
}

async function sendNotify(
  kind: OfferNotifyKind,
  contact: { phone: string | null; email: string | null; eventSlug: string | null },
  args: {
    priceEach: number;
    offerId?: string;
    eventSlug?: string;
    deadlineIso?: string | null;
  },
): Promise<void> {
  const slug = args.eventSlug ?? contact.eventSlug ?? "";
  const eventName = betaEventBySlug(slug)?.name ?? (slug || "your event");
  const deadline = args.deadlineIso
    ? new Date(args.deadlineIso).toLocaleString("en-CA", {
        timeZone: "America/Toronto",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : undefined;
  const copy = copyFor(kind, {
    eventName,
    price: args.priceEach,
    offerId: args.offerId,
    deadline,
  });

  if (contact.phone) {
    await sendSms(contact.phone, copy.sms);
  }
  if (contact.email) {
    await sendEmail({
      to: contact.email,
      subject: copy.subject,
      text: copy.text,
      html: `<p>${copy.text.replace(/\n/g, "<br/>")}</p>`,
    });
  }
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
  kind: "seller_sale_paid" | "seller_payout_released";
  sellLeadId: string;
  priceEach: number;
  offerId?: string;
  eventSlug?: string;
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
