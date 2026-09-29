import "server-only";

import {
  opsFixedPriceOrderAlert,
  opsListingAlert,
  opsMatchAlert,
  opsPaymentDeclaredAlert,
  opsWaitlistAlert,
  type OpsAlertContent,
  type OpsAlertEvent,
  type OpsMatchCustody,
} from "@/lib/email/ops-event-alerts";
import { sendEmail } from "@/lib/email/resend";
import { opsAlertEmails, platformTicketTransfer, resendOpsFromEmail } from "@/lib/env";
import { defer } from "@/lib/defer";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ops inbox alerts: a ticket was listed, someone joined a waitlist, or a match
 * needs someone to step in. Each takes an id and loads what it shows, so call
 * sites stay one line. All are fail-open — an email outage never blocks a
 * listing, a waitlist join, or an allocation.
 */

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "") ||
    "https://mcgilltickets.party"
  );
}

async function send(kind: string, to: string[], copy: OpsAlertContent, ref: string): Promise<void> {
  if (to.length === 0) return;
  try {
    const result = await sendEmail({
      to,
      from: resendOpsFromEmail(),
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
    });
    if (!result.ok) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: result.skipped ? "ops_alert_skipped_unconfigured" : "ops_alert_failed",
          kind,
          ref,
          error: result.error,
        }),
      );
    }
  } catch (err) {
    console.warn(JSON.stringify({ level: "warn", msg: "ops_alert_threw", kind, ref, error: String(err) }));
  }
}

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

async function loadEvent(slug: string): Promise<OpsAlertEvent> {
  const [{ getBetaEventBySlug }, { absoluteFlyerUrl, betaEventDayLabel }] = await Promise.all([
    import("@/domains/beta-events/catalog"),
    import("@/domains/beta-matching/notify"),
  ]);
  const event = await getBetaEventBySlug(slug);
  if (!event) return { name: slug };
  // Recurring nights in week order ("Tue, Thu, Fri, Sat"); one-offs use the
  // shared label, which formats the date.
  const day = event.days.length > 1
    ? WEEK.filter((d) => event.days.includes(d)).map((d) => d.slice(0, 3)).join(", ")
    : betaEventDayLabel(event);
  const meta = [day, event.venue].filter((v, i, all) => v && all.indexOf(v) === i).join(" · ");
  return { name: event.name, meta, flyerUrl: absoluteFlyerUrl(event.flyerUrl, siteOrigin()) };
}

function num(v: unknown): number | null {
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
}

function fullName(first: unknown, last: unknown): string | null {
  const name = [first, last]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(" ");
  return name || null;
}

/* —— 1. Listing —— */

export function notifyOpsOfListing(sellLeadId: string): void {
  defer(async () => {
    const admin = createAdminClient();
    const { data: lead } = await admin
      .from("beta_go_leads")
      .select(
        "id, event_slug, quantity, paid_each, ask_each, contact_phone, contact_instagram, ticket_share_url, ticket_evidence_path, etransfer_name, etransfer_email, etransfer_phone",
      )
      .eq("id", sellLeadId)
      .maybeSingle();
    if (!lead) return;
    const slug = lead.event_slug as string;
    const copy = opsListingAlert({
      event: await loadEvent(slug),
      leadId: lead.id as string,
      quantity: Math.max(1, Number(lead.quantity) || 1),
      askEach: num(lead.ask_each),
      paidEach: num(lead.paid_each),
      sellerName: (lead.etransfer_name as string | null) ?? null,
      contactPhone: (lead.contact_phone as string | null) ?? null,
      contactInstagram: (lead.contact_instagram as string | null) ?? null,
      ticketShareUrl: (lead.ticket_share_url as string | null) ?? null,
      hasEvidence: Boolean(lead.ticket_evidence_path),
      etransferName: (lead.etransfer_name as string | null) ?? null,
      etransferEmail: (lead.etransfer_email as string | null) ?? null,
      etransferPhone: (lead.etransfer_phone as string | null) ?? null,
      custody: slug === "cafe-campus" ? platformTicketTransfer() : null,
      opsUrl: `${siteOrigin()}/ops/sellers`,
    });
    await send("listing", opsAlertEmails(), copy, sellLeadId);
  });
}

/* —— 2. Waitlist —— */

export function notifyOpsOfWaitlistJoin(buyLeadId: string): void {
  defer(async () => {
    const admin = createAdminClient();
    const { data: lead } = await admin
      .from("beta_go_leads")
      .select(
        "id, event_slug, quantity, max_price_each, contact_phone, contact_instagram, transfer_first_name, transfer_last_name, transfer_email",
      )
      .eq("id", buyLeadId)
      .maybeSingle();
    if (!lead) return;
    const slug = lead.event_slug as string;
    const { listUnifiedQueueSeats } = await import("@/domains/beta-queue/unified");
    const seats = await listUnifiedQueueSeats(slug);
    const index = seats.findIndex((s) => s.key === `go:${buyLeadId}`);
    const copy = opsWaitlistAlert({
      event: await loadEvent(slug),
      leadId: lead.id as string,
      quantity: Math.max(1, Number(lead.quantity) || 1),
      maxPriceEach: num(lead.max_price_each),
      position: index >= 0 ? index + 1 : null,
      buyerName: fullName(lead.transfer_first_name, lead.transfer_last_name),
      transferEmail: (lead.transfer_email as string | null) ?? null,
      contactPhone: (lead.contact_phone as string | null) ?? null,
      contactInstagram: (lead.contact_instagram as string | null) ?? null,
      opsUrl: `${siteOrigin()}/ops/buyers`,
    });
    await send("waitlist", opsAlertEmails(), copy, buyLeadId);
  });
}

/* —— 3. Match —— */

async function loadMatchBuyer(
  admin: ReturnType<typeof createAdminClient>,
  offer: { buy_lead_id: string | null; classic_interest_id: string | null },
): Promise<{ name: string | null; email: string | null; phone: string | null; instagram: string | null }> {
  if (offer.buy_lead_id) {
    const { data } = await admin
      .from("beta_go_leads")
      .select("transfer_first_name, transfer_last_name, transfer_email, contact_phone, contact_instagram")
      .eq("id", offer.buy_lead_id)
      .maybeSingle();
    return {
      name: fullName(data?.transfer_first_name, data?.transfer_last_name),
      email: (data?.transfer_email as string | null) ?? null,
      phone: (data?.contact_phone as string | null) ?? null,
      instagram: (data?.contact_instagram as string | null) ?? null,
    };
  }
  if (offer.classic_interest_id) {
    const { data: interest } = await admin
      .from("beta_member_interests")
      .select("member_id")
      .eq("id", offer.classic_interest_id)
      .maybeSingle();
    if (interest?.member_id) {
      const { data: m } = await admin
        .from("beta_members")
        .select("name, email, phone")
        .eq("id", interest.member_id)
        .maybeSingle();
      return {
        name: (m?.name as string | null) ?? null,
        email: (m?.email as string | null) ?? null,
        phone: (m?.phone as string | null) ?? null,
        instagram: null,
      };
    }
  }
  return { name: null, email: null, phone: null, instagram: null };
}

/** Everything the match and payment emails show about one offer. */
async function loadOfferContext(offerId: string) {
  const admin = createAdminClient();
  const { data: offer } = await admin
    .from("beta_offers")
    .select(
      "id, unit_id, event_slug, price_each, rank, expires_at, buyer_declared_sent_at, buy_lead_id, classic_interest_id",
    )
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return null;

  const { data: unit } = await admin
    .from("beta_ticket_units")
    .select("sell_lead_id")
    .eq("id", offer.unit_id)
    .maybeSingle();
  const { data: sell } = unit?.sell_lead_id
    ? await admin
        .from("beta_go_leads")
        .select(
          "etransfer_name, etransfer_email, contact_phone, contact_instagram, seller_ticket_sent_at, ticket_received_at",
        )
        .eq("id", unit.sell_lead_id)
        .maybeSingle()
    : { data: null };

  const slug = offer.event_slug as string;
  const custody: OpsMatchCustody =
    slug !== "cafe-campus"
      ? null
      : sell?.ticket_received_at
        ? "verified"
        : sell?.seller_ticket_sent_at
          ? "declared"
          : "not_sent";

  return {
    offer,
    event: await loadEvent(slug),
    priceEach: Number(offer.price_each),
    buyer: await loadMatchBuyer(admin, {
      buy_lead_id: (offer.buy_lead_id as string | null) ?? null,
      classic_interest_id: (offer.classic_interest_id as string | null) ?? null,
    }),
    seller: {
      name: (sell?.etransfer_name as string | null) ?? null,
      phone: (sell?.contact_phone as string | null) ?? null,
      instagram: (sell?.contact_instagram as string | null) ?? null,
      etransferEmail: (sell?.etransfer_email as string | null) ?? null,
    },
    custody,
  };
}

/** A ticket was just held for a waitlist buyer. */
export function notifyOpsOfMatch(offerId: string): void {
  defer(async () => {
    const ctx = await loadOfferContext(offerId);
    if (!ctx) return;
    const copy = opsMatchAlert({
      event: ctx.event,
      offerId,
      priceEach: ctx.priceEach,
      rank: num(ctx.offer.rank),
      expiresAt: ctx.offer.expires_at as string,
      buyer: ctx.buyer,
      seller: ctx.seller,
      custody: ctx.custody,
      opsUrl: `${siteOrigin()}/ops/sellers`,
    });
    await send("match", opsAlertEmails(), copy, offerId);
  });
}

/** A resale buyer holding a ticket tapped "I've sent the money". */
export function notifyOpsOfPaymentDeclared(offerId: string, memoHint: string): void {
  defer(async () => {
    const ctx = await loadOfferContext(offerId);
    if (!ctx) return;
    const copy = opsPaymentDeclaredAlert({
      event: ctx.event,
      offerId,
      priceEach: ctx.priceEach,
      memoHint,
      declaredAt: (ctx.offer.buyer_declared_sent_at as string | null) ?? null,
      buyer: ctx.buyer,
      seller: ctx.seller,
      custody: ctx.custody,
      opsUrl: `${siteOrigin()}/ops`,
    });
    await send("payment_declared", opsAlertEmails(), copy, offerId);
  });
}

/* —— 4. Fixed-price order —— */

/**
 * A fixed-price buyer joined the queue and declared the Interac sent. Goes to
 * the people who move the money. Never blocks the buyer's queue spot.
 */
export function notifyOpsOfFixedPriceOrder(buyLeadId: string): void {
  defer(async () => {
    const admin = createAdminClient();
    const { data: lead } = await admin
      .from("beta_go_leads")
      .select(
        "id, event_slug, quantity, payment_amount, buyer_declared_sent_at, contact_phone, contact_instagram, transfer_first_name, transfer_last_name, transfer_email",
      )
      .eq("id", buyLeadId)
      .maybeSingle();
    if (!lead) return;
    const slug = lead.event_slug as string;
    const [{ listUnifiedQueueSeats }, { fixedPriceMemoHint }] = await Promise.all([
      import("@/domains/beta-queue/unified"),
      import("@/domains/beta-ops/transactions"),
    ]);
    const seats = await listUnifiedQueueSeats(slug);
    const index = seats.findIndex((s) => s.key === `go:${buyLeadId}`);
    const copy = opsFixedPriceOrderAlert({
      event: await loadEvent(slug),
      leadId: lead.id as string,
      quantity: Math.max(1, Number(lead.quantity) || 1),
      amount: num(lead.payment_amount),
      memoHint: fixedPriceMemoHint(slug),
      declaredAt: (lead.buyer_declared_sent_at as string | null) ?? null,
      position: index >= 0 ? index + 1 : null,
      buyer: {
        name: fullName(lead.transfer_first_name, lead.transfer_last_name),
        email: (lead.transfer_email as string | null) ?? null,
        phone: (lead.contact_phone as string | null) ?? null,
        instagram: (lead.contact_instagram as string | null) ?? null,
      },
      // Anchors the row on the ops board (see FixedPriceTxnRow's id).
      opsUrl: `${siteOrigin()}/ops#txn-${buyLeadId}`,
    });
    await send("fixed_price_order", opsAlertEmails(), copy, buyLeadId);
  });
}
