/**
 * Shared data-capture types and pure helpers — safe for client components.
 *
 * The SQL side (migrations 20260923090000..090500) is the source of truth for
 * what exists; this file is the vocabulary the app uses to talk about it.
 */

export const SEVERITIES = ["critical", "warning", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export type IntegrityFinding = {
  checkName: string;
  severity: Severity;
  subjectType: string | null;
  subjectId: string | null;
  subjectLabel: string | null;
  eventSlug: string | null;
  detail: Record<string, unknown>;
};

export type IntegrityRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  source: string;
  findingCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
};

export type LifecycleEntry = {
  id: number;
  occurredAt: string;
  eventName: string;
  category: string | null;
  description: string | null;
  subjectType: string;
  subjectId: string | null;
  eventSlug: string | null;
  unitId: string | null;
  offerId: string | null;
  sellLeadId: string | null;
  buyLeadId: string | null;
  contactId: string | null;
  previousState: string | null;
  newState: string | null;
  amount: number | null;
  actorKind: string;
  actorLabel: string | null;
  source: string;
  changedFields: string[];
  metadata: Record<string, unknown>;
};

export type TicketLedgerRow = {
  unitId: string;
  eventSlug: string;
  eventName: string;
  unitIndex: number;
  unitStatus: string;
  stage: string;
  priceEach: number;
  faceValue: number | null;
  listedAt: string;
  sellLeadId: string;
  sellerContactId: string | null;
  buyerSeatKind: "go" | "classic" | null;
  buyerContactId: string | null;
  buyerMemberId: string | null;
  /** Stable per-person key: go contact, else classic member, else the seat. */
  buyerKey: string | null;
  winningOfferId: string | null;
  paidAt: string | null;
  saleAmountCad: number | null;
  forwardedToBuyerAt: string | null;
  payoutReleasedAt: string | null;
  payoutConfirmedAt: string | null;
  minutesListedToPaid: number | null;
};

export type EventSalesSummary = {
  eventSlug: string;
  eventName: string;
  unitsListed: number;
  unitsAvailable: number;
  unitsSold: number;
  unitsWithdrawn: number;
  unitsOnHold: number;
  grossSalesCad: number;
  avgSalePriceCad: number | null;
  distinctBuyers: number;
  distinctSellers: number;
  sellThroughPct: number | null;
  medianMinutesToSell: number | null;
  awaitingDelivery: number;
  awaitingPayout: number;
  firstSaleAt: string | null;
  lastSaleAt: string | null;
};

export type EventDemandRow = {
  eventSlug: string;
  eventName: string;
  buySeats: number;
  classicSeats: number;
  ticketsWanted: number;
  seatsFulfilled: number;
  dormantSeats: number;
  unitsListed: number;
  unitsAvailable: number;
  unitsSold: number;
  unmetDemand: number;
  demandFilledPct: number | null;
};

/**
 * What each integrity check means and what to do about it. Keeping this beside
 * the check names rather than in the SQL means the ops console can explain a
 * finding to whoever is on shift, instead of showing them a column name.
 */
export const FINDING_GUIDE: Record<string, { title: string; action: string }> = {
  unit_sold_without_paid_offer: {
    title: "Ticket marked sold with no paid offer behind it",
    action: "Find the money first. If none exists, return the unit to the pool.",
  },
  unit_available_with_live_offer: {
    title: "Ticket is back on the market while an offer still holds it",
    action: "Close the stale offer, or mark the unit sold — they can't both be true.",
  },
  unit_withdrawn_with_paid_offer: {
    title: "Seller pulled a ticket that was already paid for",
    action: "Refund the buyer and reconcile the payout before anything else.",
  },
  multiple_live_offers_per_unit: {
    title: "Two live offers on one ticket",
    action: "Should be impossible (unique index). Escalate — this is a data bug.",
  },
  offer_paid_amount_mismatch: {
    title: "Recorded payment doesn't match the offer price",
    action: "Check the Interac amount; correct the record or open a partial-payment review.",
  },
  offer_paid_without_payment_record: {
    title: "Offer marked paid with no amount or timestamp",
    action: "Add the amount and reference so the payout has an audit trail.",
  },
  offer_forwarded_without_payment: {
    title: "Ticket was forwarded on an offer that isn't paid",
    action: "Recover the ticket or collect the money.",
  },
  payout_released_before_ticket_forwarded: {
    title: "Seller was paid before the buyer got the ticket",
    action: "Confirm the buyer actually received it.",
  },
  paid_offer_awaiting_payout: {
    title: "Seller still unpaid 72h after the buyer paid",
    action: "Send the Interac payout.",
  },
  paid_offer_ticket_not_forwarded: {
    title: "Buyer paid 24h ago and still has no ticket",
    action: "Forward it from platform custody now.",
  },
  buyer_payment_declared_unverified: {
    title: "Buyer said they sent money over 24h ago, still unverified",
    action: "Check the platform Interac inbox and confirm or fail it.",
  },
  offer_accepted_past_payment_due: {
    title: "Accepted offer past its payment deadline",
    action: "Let the sweep run, or fail it manually so the next seat gets a turn.",
  },
  offer_offered_past_expiry: {
    title: "Offer past its response clock but not yet swept",
    action: "Informational — the reconcile cron will clear it.",
  },
  unit_price_above_lead_face_value: {
    title: "Ticket priced above the seller's declared face value",
    action: "Bill 10 ceiling. Correct the price and find out how it got written.",
  },
  offer_price_above_unit_price: {
    title: "Offer priced above its ticket",
    action: "Bill 10 ceiling. Do not collect payment until corrected.",
  },
  offer_event_slug_mismatch: {
    title: "Offer and ticket disagree about which night this is",
    action: "Escalate — a trigger should have refused this write.",
  },
  offer_without_seat: {
    title: "Offer belongs to no waitlist seat",
    action: "Escalate — a constraint should have refused this write.",
  },
  unit_on_non_sell_lead: {
    title: "Ticket attached to a buy lead",
    action: "Escalate — a trigger should have refused this write.",
  },
  sell_lead_unit_count_mismatch: {
    title: "Listing quantity doesn't match the tickets materialized from it",
    action: "Run the unit backfill, or correct the quantity.",
  },
  seller_declared_ticket_not_received: {
    title: "Seller says they transferred a ticket we never received",
    action: "Check the custody inbox and chase the seller.",
  },
  ticket_received_without_declaration: {
    title: "Ticket in custody that the seller never declared",
    action: "Informational — usually an ops-entered record.",
  },
  deal_stage_conflicts_offer_status: {
    title: "Deal stage and offer status disagree",
    action: "Pick the true one and correct the other.",
  },
  duplicate_contact_identity: {
    title: "Two contacts share one Instagram handle",
    action: "Merge them, or the same person holds two waitlist seats.",
  },
  listing_sold_without_transaction: {
    title: "Card-path listing sold with no transaction",
    action: "Check Stripe before trusting the listing state.",
  },
  transaction_held_over_7_days: {
    title: "Escrow held over a week",
    action: "Release or refund it.",
  },
  transaction_released_without_sold_listing: {
    title: "Escrow released while the listing isn't sold",
    action: "Reconcile the listing state.",
  },
  lifecycle_event_unknown_name: {
    title: "Lifecycle event with a name that isn't in the catalog",
    action: "Add it to lifecycle_event_types, or fix the emitter.",
  },
  paid_offer_without_history: {
    title: "Paid offer with no payment event in its history",
    action: "Pre-dates the lifecycle log, or the backfill missed it.",
  },
};

export function describeFinding(checkName: string): { title: string; action: string } {
  return (
    FINDING_GUIDE[checkName] ?? {
      title: checkName.replace(/_/g, " "),
      action: "No guidance recorded for this check yet.",
    }
  );
}

export function severityRank(severity: Severity): number {
  return severity === "critical" ? 0 : severity === "warning" ? 1 : 2;
}

export type FindingsSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
  /** Highest severity present, or null when everything is clean. */
  worst: Severity | null;
  /** One entry per distinct check, most severe first, then most frequent. */
  byCheck: { checkName: string; severity: Severity; count: number }[];
};

/** Group findings for display. Pure — this is what the unit tests target. */
export function summarizeFindings(findings: IntegrityFinding[]): FindingsSummary {
  const counts = new Map<string, { severity: Severity; count: number }>();
  let critical = 0;
  let warning = 0;
  let info = 0;

  for (const f of findings) {
    if (f.severity === "critical") critical += 1;
    else if (f.severity === "warning") warning += 1;
    else info += 1;

    const existing = counts.get(f.checkName);
    if (existing) existing.count += 1;
    else counts.set(f.checkName, { severity: f.severity, count: 1 });
  }

  const byCheck = [...counts.entries()]
    .map(([checkName, v]) => ({ checkName, severity: v.severity, count: v.count }))
    .sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        b.count - a.count ||
        a.checkName.localeCompare(b.checkName),
    );

  return {
    total: findings.length,
    critical,
    warning,
    info,
    worst: critical > 0 ? "critical" : warning > 0 ? "warning" : info > 0 ? "info" : null,
    byCheck,
  };
}

/** Severities worth waking someone up for. */
export function alertableFindings(findings: IntegrityFinding[]): IntegrityFinding[] {
  return findings.filter((f) => f.severity === "critical");
}
