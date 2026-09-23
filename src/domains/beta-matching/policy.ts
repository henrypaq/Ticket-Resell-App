/**
 * Exclusive waitlist matching policy — pure functions only.
 *
 * The schema in `0021_ticket_units_and_offers.sql` enforces one live offer per
 * unit. This module decides *when* to offer, *how long* clocks run, and when
 * exclusivity collapses near doors. Keep side effects out of here so edge
 * cases stay unit-testable without a database.
 */

export const LIVE_OFFER_STATUSES = [
  "offered",
  "accepted",
  "paid",
  "needs_review",
] as const;

export type LiveOfferStatus = (typeof LIVE_OFFER_STATUSES)[number];

export type OfferStatus =
  | LiveOfferStatus
  | "declined"
  | "expired_no_response"
  | "expired_unpaid"
  | "payment_failed"
  | "withdrawn";

export type DeclineReason = "price" | "not_going" | "other";

export type MatchingMode = "exclusive" | "short_window" | "open";

/** Defaults from the approved design. Tunable but not scattered as magic numbers. */
export const MATCHING_DEFAULTS = {
  /** Response clock: offered → accept/decline. */
  responseMs: 45 * 60_000,
  /** Payment clock: accepted → paid. */
  paymentMs: 2 * 60 * 60_000,
  /** Max exclusive ranks before the unit opens wider. */
  exclusivityMaxRanks: 3,
  /** Max wall-clock time a unit may stay off-market under exclusivity. */
  exclusivityBudgetMs: 60 * 60_000,
  /** Inside this window of doors → short clocks. */
  shortWindowMs: 6 * 60 * 60_000,
  /** Inside this window → skip exclusivity (open / first money wins). */
  openWindowMs: 2 * 60 * 60_000,
  /** Response clock when inside the short window. */
  shortResponseMs: 20 * 60_000,
  /** Consecutive no-response expiries before dormancy. */
  noResponseStrikesToDormant: 2,
  /** Accept-then-ghost is expensive — one strike to dormant. */
  unpaidStrikesToDormant: 1,
} as const;

export type OfferClockSnapshot = {
  status: OfferStatus;
  offeredAt: Date;
  expiresAt: Date;
  paymentDueAt: Date | null;
};

export type ExclusivitySpend = {
  /** Wall-clock ms the unit has already been off-market (sum of prior exclusive holds). */
  spentMs: number;
  /** How many exclusive ranks have already been offered for this unit. */
  ranksUsed: number;
};

export function isLiveOfferStatus(status: OfferStatus): status is LiveOfferStatus {
  return (LIVE_OFFER_STATUSES as readonly string[]).includes(status);
}

/**
 * Near-doors mode. `doorsAt` null → treat as far from doors (full exclusivity).
 * Beta catalog events often lack exact door times; callers pass null until known.
 */
export function matchingModeAt(now: Date, doorsAt: Date | null): MatchingMode {
  if (!doorsAt) return "exclusive";
  const msToDoors = doorsAt.getTime() - now.getTime();
  if (msToDoors <= MATCHING_DEFAULTS.openWindowMs) return "open";
  if (msToDoors <= MATCHING_DEFAULTS.shortWindowMs) return "short_window";
  return "exclusive";
}

export function responseDeadline(args: {
  now: Date;
  mode: MatchingMode;
}): Date {
  const ms =
    args.mode === "short_window"
      ? MATCHING_DEFAULTS.shortResponseMs
      : MATCHING_DEFAULTS.responseMs;
  return new Date(args.now.getTime() + ms);
}

export function paymentDeadline(args: { now: Date; mode: MatchingMode }): Date | null {
  // Open mode: do not hold a unit on an unpaid promise near doors.
  if (args.mode === "open") return null;
  const ms =
    args.mode === "short_window"
      ? MATCHING_DEFAULTS.shortResponseMs
      : MATCHING_DEFAULTS.paymentMs;
  return new Date(args.now.getTime() + ms);
}

/**
 * Whether exclusivity budget is exhausted. When true, the next failure should
 * broadcast / open — not walk to the next rank.
 */
export function exclusivityBudgetExhausted(spend: ExclusivitySpend): boolean {
  return (
    spend.ranksUsed >= MATCHING_DEFAULTS.exclusivityMaxRanks ||
    spend.spentMs >= MATCHING_DEFAULTS.exclusivityBudgetMs
  );
}

/**
 * Ms this live (or just-ended) offer has held the unit off-market.
 * Counts response + payment windows that already elapsed up to `now`.
 */
export function offerOffMarketMs(offer: OfferClockSnapshot, now: Date): number {
  const start = offer.offeredAt.getTime();
  let end = now.getTime();

  if (offer.status === "offered") {
    end = Math.min(end, offer.expiresAt.getTime());
  } else if (offer.status === "accepted" && offer.paymentDueAt) {
    end = Math.min(end, offer.paymentDueAt.getTime());
  } else if (
    offer.status === "expired_no_response" ||
    offer.status === "declined" ||
    offer.status === "expired_unpaid" ||
    offer.status === "payment_failed"
  ) {
    // Terminal: charge through the clock that killed it (or now if somehow earlier).
    const clock =
      offer.status === "expired_unpaid" || offer.status === "payment_failed"
        ? offer.paymentDueAt?.getTime() ?? offer.expiresAt.getTime()
        : offer.expiresAt.getTime();
    end = Math.min(now.getTime(), clock);
  }

  return Math.max(0, end - start);
}

/**
 * Lazy expiry: a row past its clock is dead on read, regardless of cron.
 * Returns the terminal status to materialize, or null if still live / already terminal.
 */
export function lazyExpiryStatus(
  offer: OfferClockSnapshot,
  now: Date,
): "expired_no_response" | "expired_unpaid" | null {
  if (offer.status === "offered" && offer.expiresAt.getTime() <= now.getTime()) {
    return "expired_no_response";
  }
  if (
    offer.status === "accepted" &&
    offer.paymentDueAt != null &&
    offer.paymentDueAt.getTime() <= now.getTime()
  ) {
    return "expired_unpaid";
  }
  return null;
}

export type SeatEligibilityInput = {
  seatKey: string;
  quantity: number;
  /** Buy-side ceiling; null = no limit. */
  maxPriceEach: number | null;
  unitPriceEach: number;
  /** Live offers already held by this seat (other units). */
  liveOfferCount: number;
  dormant: boolean;
  /** Seller of this unit — never offer to yourself. */
  isSeller: boolean;
  /** Prices this seat already declined at (inclusive). */
  declinedAtOrAbove: number[];
};

export type SeatEligibility =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "dormant"
        | "seller"
        | "seat_cap"
        | "price_ceiling"
        | "declined_price"
        | "quantity_zero";
    };

export function seatEligibleForOffer(input: SeatEligibilityInput): SeatEligibility {
  if (input.quantity <= 0) return { ok: false, reason: "quantity_zero" };
  if (input.dormant) return { ok: false, reason: "dormant" };
  if (input.isSeller) return { ok: false, reason: "seller" };
  if (input.liveOfferCount >= input.quantity) return { ok: false, reason: "seat_cap" };
  if (input.maxPriceEach != null && input.unitPriceEach > input.maxPriceEach) {
    return { ok: false, reason: "price_ceiling" };
  }
  if (input.declinedAtOrAbove.some((p) => input.unitPriceEach >= p)) {
    return { ok: false, reason: "declined_price" };
  }
  return { ok: true };
}

/**
 * How many units to offer this seat right now (partial offers allowed).
 * Never more than remaining ask, never more than free units being allocated.
 */
export function partialOfferCount(args: {
  seatQuantity: number;
  liveOfferCount: number;
  freeUnits: number;
}): number {
  const remaining = Math.max(0, args.seatQuantity - args.liveOfferCount);
  return Math.min(remaining, Math.max(0, args.freeUnits));
}

export type StrikeEvent = "expired_no_response" | "expired_unpaid";

/**
 * Whether the seat should go dormant, given strike counts *including* the
 * terminal event that just landed (since last reactivation, or since joining).
 */
export function shouldGoDormant(args: {
  event: StrikeEvent;
  noResponseStrikes: number;
  unpaidStrikes: number;
}): boolean {
  if (args.event === "expired_unpaid") {
    return args.unpaidStrikes >= MATCHING_DEFAULTS.unpaidStrikesToDormant;
  }
  return args.noResponseStrikes >= MATCHING_DEFAULTS.noResponseStrikesToDormant;
}

/**
 * After a terminal offer, choose the next allocator action for that unit.
 * Accept-then-ghost burns the exclusivity budget → open, not rank+1.
 */
export function nextAllocationAction(args: {
  terminalStatus: OfferStatus;
  spendAfter: ExclusivitySpend;
  mode: MatchingMode;
}): "next_rank" | "open" | "stop" {
  if (args.mode === "open") return "open";
  if (args.terminalStatus === "withdrawn" || args.terminalStatus === "paid") return "stop";
  if (args.terminalStatus === "needs_review") return "stop";
  // Accept-then-ghost (or payment fail after accept) is expensive — prefer open
  // once budget is gone; also prefer open immediately on unpaid expiry if budget
  // was already mostly spent by the payment hold.
  if (
    args.terminalStatus === "expired_unpaid" ||
    args.terminalStatus === "payment_failed"
  ) {
    return exclusivityBudgetExhausted(args.spendAfter) ? "open" : "next_rank";
  }
  if (exclusivityBudgetExhausted(args.spendAfter)) return "open";
  return "next_rank";
}

/**
 * Rank is 1-based over *real* seats only. Fake-front padding must never be
 * passed into this list.
 */
export function rankOfSeat(seatsOldestFirst: { key: string }[], seatKey: string): number | null {
  const idx = seatsOldestFirst.findIndex((s) => s.key === seatKey);
  return idx < 0 ? null : idx + 1;
}
