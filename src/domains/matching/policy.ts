/**
 * Waitlist matching rules — pure.
 *
 * No `server-only`, no database, no clock of its own: every entry point takes
 * `now` explicitly, the same convention as `partitionWaitlistEntries`. That is
 * deliberate. These are the rules that decide who gets offered a ticket, for
 * how long, and what a failure costs them — the part that has to be exhaustively
 * testable without a Supabase project. `service.ts` does the I/O and calls in
 * here for every decision.
 *
 * The governing principle, from which most of the rest follows: **being skipped
 * or declining never costs a seat its place.** Rank is `created_at`, forever.
 * Only *eligibility* changes.
 */

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

/** Statuses that occupy a unit. Mirrors the partial unique index in 0021. */
export const OFFER_LIVE_STATUSES = ["offered", "accepted", "paid", "needs_review"] as const;

export const OFFER_TERMINAL_STATUSES = [
  "declined",
  "expired_no_response",
  "expired_unpaid",
  "payment_failed",
  "withdrawn",
] as const;

export const OFFER_STATUSES = [...OFFER_LIVE_STATUSES, ...OFFER_TERMINAL_STATUSES] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];
export type LiveOfferStatus = (typeof OFFER_LIVE_STATUSES)[number];

export type UnitStatus = "available" | "sold" | "withdrawn";
export type DeclineReason = "price" | "not_going" | "other";

const LIVE_SET = new Set<string>(OFFER_LIVE_STATUSES);

export function isLiveStatus(status: OfferStatus): status is LiveOfferStatus {
  return LIVE_SET.has(status);
}

// ---------------------------------------------------------------------------
// Tunables
//
// Times are the ones the strategy settled on. They live in one object so ops
// can be re-tuned from a single place once there's real data on how fast these
// actually sell.
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const MATCHING_POLICY = {
  /** How many distinct seats one unit may be held for before it goes broadcast. */
  exclusiveRankBudget: 3,
  /**
   * Total wall-clock a unit may spend off-market on exclusivity. Counts payment
   * time too — a buyer who accepts and takes 90 minutes has spent the budget,
   * so on failure the unit broadcasts rather than walking to rank 2.
   */
  exclusiveBudgetMs: 1 * HOUR,

  /** Response clock: offered → accepted/declined. */
  responseWindowMs: 30 * MINUTE,
  /** Payment clock: accepted → paid. Not "how long an e-transfer can take" — how long a ticket may sit on a promise. */
  paymentWindowMs: 2 * HOUR,

  /** Inside this much of doors, both clocks shorten. */
  nearDoorsMs: 6 * HOUR,
  nearDoorsResponseWindowMs: 15 * MINUTE,
  nearDoorsPaymentWindowMs: 45 * MINUTE,

  /**
   * Inside this much of doors nothing is held on a promise at all: broadcast,
   * and the unit is claimed only when payment lands.
   */
  openBeforeDoorsMs: 2 * HOUR,

  /** Strike points that make a seat dormant. */
  dormancyThreshold: 2,
  /** Silence at the offer stage. Cheap — nothing was held. */
  noResponseStrikePoints: 1,
  /** Accepted then ghosted. A ticket was off-market for it; one is enough. */
  unpaidStrikePoints: 2,
} as const;

export type MatchingPolicy = typeof MATCHING_POLICY;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** A place in the queue. Either a /go buy lead or a classic member interest. */
export type AllocationSeat = {
  seatKey: string;
  source: "classic" | "go";
  buyLeadId: string | null;
  classicInterestId: string | null;
  /** Who is behind the seat — used to block self-allocation across lead types. */
  contactId: string | null;
  memberId: string | null;
  eventSlug: string;
  /** Tickets asked for. Classic interests are always 1. */
  quantity: number;
  /** "Alert me at or under $X". Null = no ceiling. */
  maxPriceEach: number | null;
  /** Rank source. Never the padded display number. */
  createdAt: string;
  /** Re-confirm tap. Strikes are counted only from here forward. */
  reactivatedAt: string | null;
};

export type AllocationUnit = {
  id: string;
  sellLeadId: string;
  eventSlug: string;
  priceEach: number;
  status: UnitStatus;
  sellerContactId: string | null;
  sellerMemberId: string | null;
  createdAt: string;
};

export type OfferSnapshot = {
  id: string;
  groupId: string;
  unitId: string;
  seatKey: string;
  status: OfferStatus;
  priceEach: number;
  offeredAt: string;
  expiresAt: string;
  paymentDueAt: string | null;
  respondedAt: string | null;
  declineReason: DeclineReason | null;
};

// ---------------------------------------------------------------------------
// Lazy expiry
// ---------------------------------------------------------------------------

function ms(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * What an offer *actually* is right now, regardless of what the row says.
 *
 * A row past its clock is dead on read, so correctness never waits on a sweep
 * firing. The write path can't rely on this alone — Postgres can't put `now()`
 * in a partial index, so the allocator materializes the expiry before inserting
 * a successor (see `allocate_offer` in migration 0021). This is the read-side
 * half of that pair, and the two must agree exactly.
 */
export function effectiveStatus(offer: OfferSnapshot, now: Date): OfferStatus {
  if (offer.status === "offered" && ms(offer.expiresAt) <= now.getTime()) {
    return "expired_no_response";
  }
  if (
    offer.status === "accepted" &&
    offer.paymentDueAt !== null &&
    ms(offer.paymentDueAt) <= now.getTime()
  ) {
    return "expired_unpaid";
  }
  return offer.status;
}

export function isOfferLive(offer: OfferSnapshot, now: Date): boolean {
  return isLiveStatus(effectiveStatus(offer, now));
}

// ---------------------------------------------------------------------------
// Clocks
// ---------------------------------------------------------------------------

export type AllocationMode = "exclusive" | "broadcast" | "open";

export type Windows = { responseWindowMs: number; paymentWindowMs: number };

function msToDoors(now: Date, doorsAt: Date | null): number {
  if (!doorsAt) return Number.POSITIVE_INFINITY;
  return doorsAt.getTime() - now.getTime();
}

/** Both clocks shorten as doors approach. */
export function windowsFor(now: Date, doorsAt: Date | null): Windows {
  const remaining = msToDoors(now, doorsAt);
  if (remaining <= MATCHING_POLICY.nearDoorsMs) {
    return {
      responseWindowMs: MATCHING_POLICY.nearDoorsResponseWindowMs,
      paymentWindowMs: MATCHING_POLICY.nearDoorsPaymentWindowMs,
    };
  }
  return {
    responseWindowMs: MATCHING_POLICY.responseWindowMs,
    paymentWindowMs: MATCHING_POLICY.paymentWindowMs,
  };
}

/** Never let a clock run past doors — a ticket held into the event is a ticket that didn't sell. */
function clampToDoors(deadline: number, now: Date, doorsAt: Date | null): number {
  if (!doorsAt) return deadline;
  const doors = doorsAt.getTime();
  if (doors <= now.getTime()) return deadline;
  return Math.min(deadline, doors);
}

export function responseDeadline(now: Date, doorsAt: Date | null): Date {
  const { responseWindowMs } = windowsFor(now, doorsAt);
  return new Date(clampToDoors(now.getTime() + responseWindowMs, now, doorsAt));
}

export function paymentDeadline(now: Date, doorsAt: Date | null): Date {
  const { paymentWindowMs } = windowsFor(now, doorsAt);
  return new Date(clampToDoors(now.getTime() + paymentWindowMs, now, doorsAt));
}

// ---------------------------------------------------------------------------
// Exclusivity budget
// ---------------------------------------------------------------------------

export type BudgetState = {
  /** Distinct seats this unit has been held for. */
  ranksUsed: number;
  /** Wall-clock the unit has been off-market on exclusivity, including payment time. */
  spentMs: number;
  exhausted: boolean;
};

/**
 * How much of the unit's exclusivity budget is gone.
 *
 * Counted in wall-clock time off-market, not in number of offers — that is the
 * rule that stops one buyer who accepts and then ghosts from eating a whole
 * evening. A withdrawn (seller-side) offer doesn't count against it: the buyer
 * did nothing wrong and neither did the queue.
 */
export function budgetState(unitOffers: OfferSnapshot[], now: Date): BudgetState {
  const seats = new Set<string>();
  let spentMs = 0;

  for (const offer of unitOffers) {
    if (offer.status === "withdrawn") continue;
    seats.add(offer.seatKey);
    const start = ms(offer.offeredAt);
    const end = offer.respondedAt ? ms(offer.respondedAt) : now.getTime();
    if (end > start) spentMs += end - start;
  }

  return {
    ranksUsed: seats.size,
    spentMs,
    exhausted:
      seats.size >= MATCHING_POLICY.exclusiveRankBudget ||
      spentMs >= MATCHING_POLICY.exclusiveBudgetMs,
  };
}

/**
 * Exclusive (hold it for one seat) → broadcast (tell every eligible seat, first
 * to respond wins) → open (inside doors range; nothing is held at all, and the
 * unit is claimed only when payment lands).
 */
export function allocationMode(args: {
  unitOffers: OfferSnapshot[];
  now: Date;
  doorsAt: Date | null;
}): AllocationMode {
  if (msToDoors(args.now, args.doorsAt) <= MATCHING_POLICY.openBeforeDoorsMs) return "open";
  return budgetState(args.unitOffers, args.now).exhausted ? "broadcast" : "exclusive";
}

// ---------------------------------------------------------------------------
// Strikes and dormancy
// ---------------------------------------------------------------------------

export type StrikeState = {
  points: number;
  noResponse: number;
  unpaid: number;
  dormant: boolean;
  /** Strikes are only counted after this instant. */
  countedSince: string | null;
};

/**
 * The asymmetry that makes declining safe: an explicit decline is free and
 * informative, silence is what costs.
 *
 * Only *consecutive* misses count — a completed purchase or a re-confirm tap
 * wipes the slate, so a regular buyer who missed one DM in March isn't dormant
 * in September.
 */
export function strikeState(
  seat: Pick<AllocationSeat, "reactivatedAt">,
  seatOffers: OfferSnapshot[],
  now: Date,
): StrikeState {
  let since = seat.reactivatedAt ? ms(seat.reactivatedAt) : 0;

  // A paid offer resets the count — this seat clearly still shows up.
  for (const offer of seatOffers) {
    if (effectiveStatus(offer, now) === "paid") {
      since = Math.max(since, ms(offer.offeredAt));
    }
  }

  let noResponse = 0;
  let unpaid = 0;

  for (const offer of seatOffers) {
    if (ms(offer.offeredAt) < since) continue;
    const status = effectiveStatus(offer, now);
    if (status === "expired_no_response") noResponse += 1;
    else if (status === "expired_unpaid") unpaid += 1;
  }

  const points =
    noResponse * MATCHING_POLICY.noResponseStrikePoints +
    unpaid * MATCHING_POLICY.unpaidStrikePoints;

  return {
    points,
    noResponse,
    unpaid,
    dormant: points >= MATCHING_POLICY.dormancyThreshold,
    countedSince: since > 0 ? new Date(since).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type IneligibleReason =
  | "wrong_event"
  | "dormant"
  | "left_queue"
  | "above_ceiling"
  | "declined_this_price"
  | "self_allocation"
  | "at_capacity";

export type Eligibility = { eligible: true } | { eligible: false; reason: IneligibleReason };

/**
 * Can this seat be offered this unit right now?
 *
 * Note what is *not* here: rank. Being skipped by any of these never changes a
 * seat's position — it is offered the very next unit it does qualify for.
 */
export function seatEligibility(args: {
  seat: AllocationSeat;
  unit: AllocationUnit;
  /** Every offer ever made to this seat (any unit). */
  seatOffers: OfferSnapshot[];
  /** Live offers this seat already holds, after lazy expiry. */
  liveHeld: number;
  now: Date;
}): Eligibility {
  const { seat, unit, seatOffers, liveHeld, now } = args;

  if (seat.eventSlug !== unit.eventSlug) return { eligible: false, reason: "wrong_event" };

  // "Not going anymore" takes the seat out entirely — unlike a price pass.
  if (seatOffers.some((o) => o.declineReason === "not_going")) {
    return { eligible: false, reason: "left_queue" };
  }

  // Self-dealing: a contact can hold both a buy and a sell lead for one night,
  // so match on the person, not the lead.
  if (
    (seat.contactId !== null && seat.contactId === unit.sellerContactId) ||
    (seat.memberId !== null && seat.memberId === unit.sellerMemberId)
  ) {
    return { eligible: false, reason: "self_allocation" };
  }

  // Ceiling. Inclusive: "at or under $X" means $X qualifies.
  if (seat.maxPriceEach !== null && unit.priceEach > seat.maxPriceEach) {
    return { eligible: false, reason: "above_ceiling" };
  }

  // Passed on price before: don't re-offer at or above what they already
  // refused. A cheaper unit is a genuinely different proposition.
  const refusedAtOrBelow = seatOffers.some(
    (o) => o.declineReason === "price" && o.priceEach <= unit.priceEach,
  );
  if (refusedAtOrBelow) return { eligible: false, reason: "declined_this_price" };

  if (strikeState(seat, seatOffers, now).dormant) return { eligible: false, reason: "dormant" };

  if (liveHeld >= seat.quantity) return { eligible: false, reason: "at_capacity" };

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

export type PlannedOffer = {
  unitId: string;
  seatKey: string;
  buyLeadId: string | null;
  classicInterestId: string | null;
  eventSlug: string;
  /** Real 1-based queue rank. Padding is display-only and never allocatable. */
  rank: number;
  priceEach: number;
  /** Shared by units allocated together to one seat asking for several. */
  groupId: string;
  expiresAt: string;
};

export type PlannedBroadcast = {
  unitId: string;
  eventSlug: string;
  priceEach: number;
  seatKeys: string[];
  mode: "broadcast" | "open";
};

export type IdleUnit = {
  unitId: string;
  reason: "claimed" | "not_available" | "no_eligible_seat";
};

export type AllocationPlan = {
  offers: PlannedOffer[];
  broadcasts: PlannedBroadcast[];
  idle: IdleUnit[];
};

/** Queue order: oldest first, seat key as a stable tiebreak. Matches `listUnifiedQueueSeats`. */
export function rankSeats(seats: AllocationSeat[]): AllocationSeat[] {
  return [...seats].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    if (byTime !== 0) return byTime;
    return a.seatKey.localeCompare(b.seatKey);
  });
}

/**
 * The allocator. One pass, rank order, per event.
 *
 * Two properties worth stating because they are what the tests pin down:
 *
 * 1. Several units dropping at once are spread down the queue — they do not all
 *    go to rank 1. A seat takes more than one only up to what it asked for, and
 *    those siblings share a group id so accepting is all-or-nothing.
 * 2. A unit whose budget is spent degrades to broadcast rather than continuing
 *    to walk the queue, and inside `openBeforeDoorsMs` nothing is held at all.
 *    The feature failing into the behaviour that already existed is the point.
 */
export function planAllocation(args: {
  units: AllocationUnit[];
  seats: AllocationSeat[];
  /** Every offer for the units and seats in play. */
  offers: OfferSnapshot[];
  now: Date;
  doorsAt: Date | null;
  newGroupId?: () => string;
}): AllocationPlan {
  const { units, seats, offers, now, doorsAt } = args;
  const newGroupId = args.newGroupId ?? defaultGroupId;

  const offersByUnit = groupBy(offers, (o) => o.unitId);
  const offersBySeat = groupBy(offers, (o) => o.seatKey);

  // Capacity already consumed by live offers, decremented as we plan more.
  const held = new Map<string, number>();
  for (const seat of seats) {
    const live = (offersBySeat.get(seat.seatKey) ?? []).filter((o) => isOfferLive(o, now)).length;
    held.set(seat.seatKey, live);
  }

  const ranked = rankSeats(seats);
  const rankOf = new Map(ranked.map((s, i) => [s.seatKey, i + 1]));

  // Cheapest first, then oldest: a buyer waiting for a better price should be
  // offered the better price when one exists.
  const candidates = [...units].sort((a, b) => {
    if (a.priceEach !== b.priceEach) return a.priceEach - b.priceEach;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const plan: AllocationPlan = { offers: [], broadcasts: [], idle: [] };
  // One group id per (seat, pass) so a seat's siblings land together.
  const groupForSeat = new Map<string, string>();

  for (const unit of candidates) {
    const unitOffers = offersByUnit.get(unit.id) ?? [];

    if (unit.status !== "available") {
      plan.idle.push({ unitId: unit.id, reason: "not_available" });
      continue;
    }
    if (unitOffers.some((o) => isOfferLive(o, now))) {
      plan.idle.push({ unitId: unit.id, reason: "claimed" });
      continue;
    }

    const eligible = ranked.filter(
      (seat) =>
        seatEligibility({
          seat,
          unit,
          seatOffers: offersBySeat.get(seat.seatKey) ?? [],
          liveHeld: held.get(seat.seatKey) ?? 0,
          now,
        }).eligible,
    );

    const mode = allocationMode({ unitOffers, now, doorsAt });

    if (mode !== "exclusive") {
      // Nothing is held: everyone eligible hears about it, first to respond
      // wins. `seatKeys` may be empty — that is a quiet no-op, not an error.
      plan.broadcasts.push({
        unitId: unit.id,
        eventSlug: unit.eventSlug,
        priceEach: unit.priceEach,
        seatKeys: eligible.map((s) => s.seatKey),
        mode,
      });
      continue;
    }

    const winner = eligible[0];
    if (!winner) {
      plan.idle.push({ unitId: unit.id, reason: "no_eligible_seat" });
      continue;
    }

    let groupId = groupForSeat.get(winner.seatKey);
    if (!groupId) {
      groupId = newGroupId();
      groupForSeat.set(winner.seatKey, groupId);
    }

    plan.offers.push({
      unitId: unit.id,
      seatKey: winner.seatKey,
      buyLeadId: winner.buyLeadId,
      classicInterestId: winner.classicInterestId,
      eventSlug: unit.eventSlug,
      rank: rankOf.get(winner.seatKey) ?? 1,
      priceEach: unit.priceEach,
      groupId,
      expiresAt: responseDeadline(now, doorsAt).toISOString(),
    });

    held.set(winner.seatKey, (held.get(winner.seatKey) ?? 0) + 1);
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export type TransitionResult =
  | { ok: true; status: OfferStatus; paymentDueAt?: string | null }
  | { ok: false; error: string };

/**
 * Which transitions are legal, and where a human is required.
 *
 * The line is money movement: auto-advance freely before `accepted → paid`,
 * require a person once funds might be in flight. `needs_review` exists for
 * exactly that — a partial or ambiguous e-transfer must never auto-requeue the
 * unit, because auto-advancing a ticket whose money might still land is how you
 * double-sell it.
 */
const ALLOWED_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  offered: ["accepted", "declined", "expired_no_response", "withdrawn"],
  accepted: ["paid", "needs_review", "expired_unpaid", "payment_failed", "declined", "withdrawn"],
  needs_review: ["paid", "payment_failed", "withdrawn"],
  paid: ["payment_failed", "withdrawn"],
  declined: [],
  expired_no_response: [],
  expired_unpaid: [],
  payment_failed: [],
  withdrawn: [],
};

export function canTransition(from: OfferStatus, to: OfferStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Applies a transition against the offer's *effective* status, so an ops click
 * on a row whose clock already ran out is rejected rather than silently
 * resurrecting a dead offer.
 */
export function applyTransition(args: {
  offer: OfferSnapshot;
  to: OfferStatus;
  now: Date;
  doorsAt: Date | null;
}): TransitionResult {
  const from = effectiveStatus(args.offer, args.now);

  if (from === args.to) return { ok: false, error: `Offer is already ${from}.` };

  if (!canTransition(from, args.to)) {
    return { ok: false, error: `Can't move an offer from ${from} to ${args.to}.` };
  }

  if (args.to === "accepted") {
    return {
      ok: true,
      status: "accepted",
      paymentDueAt: paymentDeadline(args.now, args.doorsAt).toISOString(),
    };
  }

  return { ok: true, status: args.to };
}

/**
 * Where a seat goes after a seller withdrawal.
 *
 * The one path that must not requeue the unit — it's a refund, not a
 * reallocation. The buyer did everything right, so they go to the *front* for
 * the next unit rather than back to their original rank.
 */
export function withdrawalCompensation(offer: OfferSnapshot): {
  requeueUnit: false;
  seatKey: string;
  priority: "front";
} {
  return { requeueUnit: false, seatKey: offer.seatKey, priority: "front" };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

let groupCounter = 0;
function defaultGroupId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  groupCounter += 1;
  return `group-${groupCounter}`;
}
