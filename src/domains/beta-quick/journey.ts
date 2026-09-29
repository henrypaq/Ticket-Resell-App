/**
 * Where a buyer or seller is in their journey — one answer shared by the home
 * wallet cards and the full-screen journey pages, so a card never says
 * "Sold" while the page it opens says "Listed".
 *
 * Pure functions over the hub DTOs; no I/O, safe on client and server.
 */
import type { BuyerOfferSummary, GoActivityEntry, QuickWaitlistEntry } from "./shared";

/** Events where sellers hand the ticket to us before it goes live. */
export const CUSTODY_EVENT_SLUGS = new Set(["cafe-campus"]);

export type BuyerStage =
  | "waiting" // in line, nothing held
  | "queue" // fixed-price: paid at checkout, waiting on ops to confirm
  | "held" // marketplace: a ticket is held, buyer must answer
  | "pay" // marketplace: claimed, buyer must send Interac
  | "payment_sent" // buyer says the money is sent, we haven't matched it
  | "review" // payment needs a human look
  | "confirmed" // money confirmed, ticket on its way
  | "transferred" // ticket delivered
  | "received"; // buyer confirmed it arrived — off home

export type BuyerJourney = {
  stage: BuyerStage;
  /** The offer this stage is about (marketplace only). */
  offer: BuyerOfferSummary | null;
  /** Where the card / row should open. */
  href: string;
};

function isFixedPrice(entry: QuickWaitlistEntry): boolean {
  return (
    entry.paymentAmount != null ||
    Boolean(entry.buyerDeclaredSentAt) ||
    Boolean(entry.paymentRecordedAt)
  );
}

export function buyerJourney(entry: QuickWaitlistEntry): BuyerJourney {
  const queueHref = `/queue?lead=${entry.leadId}&event=${encodeURIComponent(entry.eventSlug)}`;

  if (entry.ticketForwardedAt) {
    return {
      stage: entry.buyerConfirmedReceivedAt ? "received" : "transferred",
      offer: null,
      href: queueHref,
    };
  }

  if (isFixedPrice(entry)) {
    return {
      stage: entry.paymentRecordedAt ? "confirmed" : "queue",
      offer: null,
      href: queueHref,
    };
  }

  // Marketplace: the stage that needs the buyer most wins, so a pair with one
  // ticket paid and one freshly held still surfaces the hold.
  const offers = entry.offers ?? [];
  const pick = (pred: (o: BuyerOfferSummary) => boolean) => offers.find(pred) ?? null;
  const order: [BuyerStage, (o: BuyerOfferSummary) => boolean][] = [
    ["held", (o) => o.status === "offered"],
    ["pay", (o) => o.status === "accepted" && !o.buyerDeclaredSentAt],
    ["payment_sent", (o) => o.status === "accepted" && Boolean(o.buyerDeclaredSentAt)],
    ["review", (o) => o.status === "needs_review"],
    ["confirmed", (o) => o.status === "paid"],
  ];
  for (const [stage, pred] of order) {
    const offer = pick(pred);
    if (offer) return { stage, offer, href: `/offer/${offer.id}` };
  }

  // /queue renders the live "you're in line" screen for marketplace seats.
  return { stage: "waiting", offer: null, href: queueHref };
}

/** Stages that belong in the home "Your tickets" wallet rather than the waitlist. */
export function isWalletStage(stage: BuyerStage): boolean {
  return (
    stage === "held" ||
    stage === "pay" ||
    stage === "payment_sent" ||
    stage === "review" ||
    stage === "confirmed" ||
    stage === "transferred"
  );
}

export type SellerStage =
  | "send" // custody event: seller still needs to send us the ticket
  | "checking" // seller says it's sent; we're verifying it
  | "live" // listed, waiting for a buyer
  | "claimed" // a buyer claimed it and is paying
  | "sold" // buyer paid; payout on its way
  | "paid_out" // every sold ticket's payout released
  | "closed"; // cancelled / past and unsold

export type SellerJourney = {
  stage: SellerStage;
  /** 1-based position on the five-step journey bar. */
  step: number;
  requiresCustody: boolean;
};

export function sellerJourney(entry: GoActivityEntry): SellerJourney {
  const requiresCustody = CUSTODY_EVENT_SLUGS.has(entry.eventSlug);
  const sold = entry.soldCount ?? 0;
  const released = entry.payoutReleasedCount ?? 0;
  const claimed = entry.claimedCount ?? 0;

  let stage: SellerStage;
  if (entry.status === "cancelled") stage = "closed";
  else if (sold > 0 && released >= sold) stage = "paid_out";
  else if (sold > 0) stage = "sold";
  else if (entry.status === "done") stage = "paid_out";
  else if (claimed > 0) stage = "claimed";
  else if (requiresCustody && !entry.sellerTicketSentAt && !entry.ticketReceivedAt) stage = "send";
  else if (requiresCustody && !entry.ticketReceivedAt) stage = "checking";
  else stage = "live";

  const step =
    stage === "send"
      ? 1
      : stage === "checking"
        ? 2
        : stage === "live" || stage === "closed"
          ? 3
          : stage === "claimed" || stage === "sold"
            ? 4
            : 5;

  return { stage, step, requiresCustody };
}

/** A listing that has sold (or is mid-sale) must never be treated as unsold. */
export function sellerHasSale(entry: GoActivityEntry): boolean {
  return (
    (entry.soldCount ?? 0) > 0 ||
    (entry.claimedCount ?? 0) > 0 ||
    entry.saleStage != null
  );
}
