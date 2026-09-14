import { describe, expect, it } from "vitest";

import {
  MATCHING_POLICY,
  allocationMode,
  applyTransition,
  budgetState,
  canTransition,
  effectiveStatus,
  isOfferLive,
  paymentDeadline,
  planAllocation,
  rankSeats,
  responseDeadline,
  seatEligibility,
  strikeState,
  windowsFor,
  withdrawalCompensation,
  type AllocationSeat,
  type AllocationUnit,
  type OfferSnapshot,
  type OfferStatus,
} from "./policy";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const NOW = new Date("2026-09-12T18:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();

// Far enough out that the near-doors clamps never fire unless a test asks.
const FAR_DOORS = new Date(NOW.getTime() + 30 * HOUR);

function seat(overrides: Partial<AllocationSeat> = {}): AllocationSeat {
  return {
    seatKey: "go:seat-1",
    source: "go",
    buyLeadId: "seat-1",
    classicInterestId: null,
    contactId: "contact-1",
    memberId: null,
    eventSlug: "cafe-campus",
    quantity: 1,
    maxPriceEach: null,
    createdAt: "2026-09-10T10:00:00.000Z",
    reactivatedAt: null,
    ...overrides,
  };
}

function unit(overrides: Partial<AllocationUnit> = {}): AllocationUnit {
  return {
    id: "unit-1",
    sellLeadId: "sell-1",
    eventSlug: "cafe-campus",
    priceEach: 40,
    status: "available",
    sellerContactId: "seller-contact",
    sellerMemberId: null,
    createdAt: "2026-09-12T12:00:00.000Z",
    ...overrides,
  };
}

function offer(overrides: Partial<OfferSnapshot> = {}): OfferSnapshot {
  return {
    id: "offer-1",
    groupId: "group-1",
    unitId: "unit-1",
    seatKey: "go:seat-1",
    status: "offered",
    priceEach: 40,
    offeredAt: at(-10 * MINUTE),
    expiresAt: at(20 * MINUTE),
    paymentDueAt: null,
    respondedAt: null,
    declineReason: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe("effectiveStatus — lazy expiry", () => {
  it("leaves a live offer inside its response window alone", () => {
    expect(effectiveStatus(offer(), NOW)).toBe("offered");
    expect(isOfferLive(offer(), NOW)).toBe(true);
  });

  it("treats an offer past its response window as expired without a sweep", () => {
    const stale = offer({ expiresAt: at(-1 * MINUTE) });
    expect(effectiveStatus(stale, NOW)).toBe("expired_no_response");
    expect(isOfferLive(stale, NOW)).toBe(false);
  });

  it("expires exactly on the deadline, not a millisecond later", () => {
    // The SQL sweep uses `expires_at <= now`; the two must agree exactly or a
    // row is live on one side of the system and dead on the other.
    expect(effectiveStatus(offer({ expiresAt: NOW.toISOString() }), NOW)).toBe(
      "expired_no_response",
    );
    expect(effectiveStatus(offer({ expiresAt: at(1) }), NOW)).toBe("offered");
  });

  it("expires an accepted offer whose payment clock ran out", () => {
    const ghosted = offer({
      status: "accepted",
      paymentDueAt: at(-1 * MINUTE),
      expiresAt: at(-30 * MINUTE),
    });
    expect(effectiveStatus(ghosted, NOW)).toBe("expired_unpaid");
  });

  it("never expires an accepted offer that has no payment clock set", () => {
    const accepted = offer({ status: "accepted", paymentDueAt: null, expiresAt: at(-1 * HOUR) });
    expect(effectiveStatus(accepted, NOW)).toBe("accepted");
  });

  it("never expires a paid offer", () => {
    const paid = offer({ status: "paid", paymentDueAt: at(-5 * HOUR), expiresAt: at(-9 * HOUR) });
    expect(effectiveStatus(paid, NOW)).toBe("paid");
    expect(isOfferLive(paid, NOW)).toBe(true);
  });

  it("leaves terminal statuses untouched", () => {
    for (const status of ["declined", "payment_failed", "withdrawn"] as OfferStatus[]) {
      const done = offer({ status, expiresAt: at(-1 * HOUR) });
      expect(effectiveStatus(done, NOW)).toBe(status);
      expect(isOfferLive(done, NOW)).toBe(false);
    }
  });

  it("keeps needs_review live so an ambiguous payment can't be auto-requeued", () => {
    const review = offer({
      status: "needs_review",
      paymentDueAt: at(-2 * HOUR),
      expiresAt: at(-3 * HOUR),
    });
    expect(effectiveStatus(review, NOW)).toBe("needs_review");
    expect(isOfferLive(review, NOW)).toBe(true);
  });
});

describe("clocks", () => {
  it("uses the full windows when doors are far away", () => {
    expect(windowsFor(NOW, FAR_DOORS)).toEqual({
      responseWindowMs: MATCHING_POLICY.responseWindowMs,
      paymentWindowMs: MATCHING_POLICY.paymentWindowMs,
    });
  });

  it("uses the full windows for an event with no doors time at all", () => {
    expect(windowsFor(NOW, null).responseWindowMs).toBe(MATCHING_POLICY.responseWindowMs);
  });

  it("shortens both clocks inside six hours of doors", () => {
    const doors = new Date(NOW.getTime() + 5 * HOUR);
    expect(windowsFor(NOW, doors)).toEqual({
      responseWindowMs: MATCHING_POLICY.nearDoorsResponseWindowMs,
      paymentWindowMs: MATCHING_POLICY.nearDoorsPaymentWindowMs,
    });
  });

  it("never sets a deadline past doors", () => {
    const doors = new Date(NOW.getTime() + 10 * MINUTE);
    expect(responseDeadline(NOW, doors).getTime()).toBe(doors.getTime());
    expect(paymentDeadline(NOW, doors).getTime()).toBe(doors.getTime());
  });

  it("falls back to the plain window once doors are already behind us", () => {
    const doors = new Date(NOW.getTime() - 1 * HOUR);
    expect(responseDeadline(NOW, doors).getTime()).toBe(
      NOW.getTime() + MATCHING_POLICY.nearDoorsResponseWindowMs,
    );
  });
});

describe("budgetState — exclusivity measured in time off-market", () => {
  it("is unspent for a unit nobody has been offered", () => {
    expect(budgetState([], NOW)).toEqual({ ranksUsed: 0, spentMs: 0, exhausted: false });
  });

  it("counts two quick declines as cheap", () => {
    const offers = [
      offer({
        id: "a",
        seatKey: "go:a",
        status: "declined",
        offeredAt: at(-40 * MINUTE),
        respondedAt: at(-35 * MINUTE),
      }),
      offer({
        id: "b",
        seatKey: "go:b",
        status: "declined",
        offeredAt: at(-35 * MINUTE),
        respondedAt: at(-30 * MINUTE),
      }),
    ];
    const state = budgetState(offers, NOW);
    expect(state.ranksUsed).toBe(2);
    expect(state.spentMs).toBe(10 * MINUTE);
    expect(state.exhausted).toBe(false);
  });

  it("burns the whole budget on one accept-then-ghost", () => {
    const ghost = offer({
      seatKey: "go:a",
      status: "expired_unpaid",
      offeredAt: at(-90 * MINUTE),
      respondedAt: at(-1 * MINUTE),
    });
    const state = budgetState([ghost], NOW);
    expect(state.spentMs).toBeGreaterThanOrEqual(MATCHING_POLICY.exclusiveBudgetMs);
    expect(state.exhausted).toBe(true);
  });

  it("counts an offer that is still open against the budget as it runs", () => {
    const open = offer({ offeredAt: at(-70 * MINUTE), expiresAt: at(10 * MINUTE) });
    expect(budgetState([open], NOW).spentMs).toBe(70 * MINUTE);
  });

  it("exhausts on rank count once three distinct seats have been tried", () => {
    const offers = ["a", "b", "c"].map((k, i) =>
      offer({
        id: k,
        seatKey: `go:${k}`,
        status: "declined",
        offeredAt: at(-(10 - i) * MINUTE),
        respondedAt: at(-(9 - i) * MINUTE),
      }),
    );
    expect(budgetState(offers, NOW)).toMatchObject({ ranksUsed: 3, exhausted: true });
  });

  it("does not charge the budget for a seller withdrawal", () => {
    const pulled = offer({
      status: "withdrawn",
      offeredAt: at(-5 * HOUR),
      respondedAt: at(-1 * MINUTE),
    });
    expect(budgetState([pulled], NOW)).toEqual({ ranksUsed: 0, spentMs: 0, exhausted: false });
  });
});

describe("allocationMode", () => {
  it("holds the ticket exclusively when the budget is fresh", () => {
    expect(allocationMode({ unitOffers: [], now: NOW, doorsAt: FAR_DOORS })).toBe("exclusive");
  });

  it("degrades to broadcast once the budget is spent", () => {
    const ghost = offer({
      status: "expired_unpaid",
      offeredAt: at(-90 * MINUTE),
      respondedAt: at(-1 * MINUTE),
    });
    expect(allocationMode({ unitOffers: [ghost], now: NOW, doorsAt: FAR_DOORS })).toBe("broadcast");
  });

  it("holds nothing at all inside two hours of doors", () => {
    const doors = new Date(NOW.getTime() + 90 * MINUTE);
    expect(allocationMode({ unitOffers: [], now: NOW, doorsAt: doors })).toBe("open");
  });

  it("is open once doors are behind us", () => {
    const doors = new Date(NOW.getTime() - 30 * MINUTE);
    expect(allocationMode({ unitOffers: [], now: NOW, doorsAt: doors })).toBe("open");
  });

  it("stays exclusive for an event with no doors time", () => {
    expect(allocationMode({ unitOffers: [], now: NOW, doorsAt: null })).toBe("exclusive");
  });
});

describe("strikeState — silence costs, declining does not", () => {
  it("does not penalise an explicit decline at all", () => {
    const declined = [
      offer({ id: "a", status: "declined", declineReason: "price", respondedAt: at(-1 * HOUR) }),
      offer({ id: "b", status: "declined", declineReason: "price", respondedAt: at(-2 * HOUR) }),
    ];
    expect(strikeState(seat(), declined, NOW).dormant).toBe(false);
  });

  it("tolerates one ignored offer", () => {
    const missed = [offer({ status: "expired_no_response" })];
    const state = strikeState(seat(), missed, NOW);
    expect(state.noResponse).toBe(1);
    expect(state.dormant).toBe(false);
  });

  it("goes dormant on the second consecutive ignored offer", () => {
    const missed = [
      offer({ id: "a", status: "expired_no_response" }),
      offer({ id: "b", status: "expired_no_response" }),
    ];
    expect(strikeState(seat(), missed, NOW).dormant).toBe(true);
  });

  it("goes dormant on a single accept-then-ghost", () => {
    const ghost = [offer({ status: "expired_unpaid", paymentDueAt: at(-1 * MINUTE) })];
    const state = strikeState(seat(), ghost, NOW);
    expect(state.unpaid).toBe(1);
    expect(state.points).toBe(MATCHING_POLICY.dormancyThreshold);
    expect(state.dormant).toBe(true);
  });

  it("counts a lazily-expired row the same as a written-down one", () => {
    // Still `offered` in the database, but past its clock.
    const unswept = [
      offer({ id: "a", expiresAt: at(-1 * MINUTE) }),
      offer({ id: "b", expiresAt: at(-2 * MINUTE) }),
    ];
    expect(strikeState(seat(), unswept, NOW).dormant).toBe(true);
  });

  it("wipes the slate after a completed purchase", () => {
    const history = [
      offer({ id: "a", status: "expired_no_response", offeredAt: at(-10 * HOUR) }),
      offer({ id: "b", status: "expired_no_response", offeredAt: at(-9 * HOUR) }),
      offer({ id: "c", status: "paid", offeredAt: at(-8 * HOUR) }),
    ];
    const state = strikeState(seat(), history, NOW);
    expect(state.noResponse).toBe(0);
    expect(state.dormant).toBe(false);
  });

  it("counts only from a re-confirm tap forward", () => {
    const history = [
      offer({ id: "a", status: "expired_no_response", offeredAt: at(-10 * HOUR) }),
      offer({ id: "b", status: "expired_no_response", offeredAt: at(-9 * HOUR) }),
      offer({ id: "c", status: "expired_no_response", offeredAt: at(-1 * HOUR) }),
    ];
    const reactivated = seat({ reactivatedAt: at(-2 * HOUR) });
    const state = strikeState(reactivated, history, NOW);
    expect(state.noResponse).toBe(1);
    expect(state.dormant).toBe(false);
  });
});

describe("seatEligibility", () => {
  const base = { unit: unit(), seatOffers: [] as OfferSnapshot[], liveHeld: 0, now: NOW };

  it("accepts a seat with no ceiling", () => {
    expect(seatEligibility({ ...base, seat: seat() })).toEqual({ eligible: true });
  });

  it("treats a ceiling exactly equal to the price as eligible", () => {
    // "At or under $40" has to include $40, or every round-number ceiling is
    // silently off by one ticket.
    expect(seatEligibility({ ...base, seat: seat({ maxPriceEach: 40 }) })).toEqual({
      eligible: true,
    });
  });

  it("skips a seat whose ceiling is below the price", () => {
    expect(seatEligibility({ ...base, seat: seat({ maxPriceEach: 39.99 }) })).toEqual({
      eligible: false,
      reason: "above_ceiling",
    });
  });

  it("offers a cheaper ticket to someone who passed on a dearer one", () => {
    const passedAt40 = [offer({ status: "declined", declineReason: "price", priceEach: 40 })];
    expect(
      seatEligibility({ ...base, unit: unit({ priceEach: 30 }), seat: seat(), seatOffers: passedAt40 }),
    ).toEqual({ eligible: true });
  });

  it("does not re-offer the same price someone already passed on", () => {
    const passedAt40 = [offer({ status: "declined", declineReason: "price", priceEach: 40 })];
    expect(seatEligibility({ ...base, seat: seat(), seatOffers: passedAt40 })).toEqual({
      eligible: false,
      reason: "declined_this_price",
    });
  });

  it("does not re-offer a dearer ticket than one already passed on", () => {
    const passedAt30 = [offer({ status: "declined", declineReason: "price", priceEach: 30 })];
    expect(
      seatEligibility({ ...base, unit: unit({ priceEach: 45 }), seat: seat(), seatOffers: passedAt30 }),
    ).toEqual({ eligible: false, reason: "declined_this_price" });
  });

  it("takes someone who said they aren't going out of the queue entirely", () => {
    const gone = [offer({ status: "declined", declineReason: "not_going", priceEach: 40 })];
    expect(
      seatEligibility({ ...base, unit: unit({ priceEach: 5 }), seat: seat(), seatOffers: gone }),
    ).toEqual({ eligible: false, reason: "left_queue" });
  });

  it("blocks a seller from being allocated their own ticket via the contact behind it", () => {
    expect(
      seatEligibility({ ...base, seat: seat({ contactId: "seller-contact" }) }),
    ).toEqual({ eligible: false, reason: "self_allocation" });
  });

  it("blocks self-allocation across lead types via the member id", () => {
    expect(
      seatEligibility({
        ...base,
        unit: unit({ sellerContactId: null, sellerMemberId: "member-9" }),
        seat: seat({ contactId: null, memberId: "member-9" }),
      }),
    ).toEqual({ eligible: false, reason: "self_allocation" });
  });

  it("does not confuse two seats that both have null identifiers", () => {
    expect(
      seatEligibility({
        ...base,
        unit: unit({ sellerContactId: null, sellerMemberId: null }),
        seat: seat({ contactId: null, memberId: null }),
      }),
    ).toEqual({ eligible: true });
  });

  it("skips a dormant seat", () => {
    const missed = [
      offer({ id: "a", status: "expired_no_response" }),
      offer({ id: "b", status: "expired_no_response" }),
    ];
    expect(seatEligibility({ ...base, seat: seat(), seatOffers: missed })).toEqual({
      eligible: false,
      reason: "dormant",
    });
  });

  it("skips a seat already holding as many tickets as it asked for", () => {
    expect(seatEligibility({ ...base, seat: seat({ quantity: 1 }), liveHeld: 1 })).toEqual({
      eligible: false,
      reason: "at_capacity",
    });
  });

  it("still has room for a two-ticket seat holding one", () => {
    expect(seatEligibility({ ...base, seat: seat({ quantity: 2 }), liveHeld: 1 })).toEqual({
      eligible: true,
    });
  });

  it("never crosses events", () => {
    expect(seatEligibility({ ...base, seat: seat({ eventSlug: "piknik-electronik" }) })).toEqual({
      eligible: false,
      reason: "wrong_event",
    });
  });
});

describe("rankSeats", () => {
  it("orders oldest first and breaks ties deterministically", () => {
    const seats = [
      seat({ seatKey: "go:b", createdAt: "2026-09-10T10:00:00.000Z" }),
      seat({ seatKey: "go:a", createdAt: "2026-09-10T10:00:00.000Z" }),
      seat({ seatKey: "go:c", createdAt: "2026-09-09T10:00:00.000Z" }),
    ];
    expect(rankSeats(seats).map((s) => s.seatKey)).toEqual(["go:c", "go:a", "go:b"]);
  });

  it("does not mutate its input", () => {
    const seats = [
      seat({ seatKey: "go:b", createdAt: "2026-09-11T10:00:00.000Z" }),
      seat({ seatKey: "go:a", createdAt: "2026-09-10T10:00:00.000Z" }),
    ];
    rankSeats(seats);
    expect(seats[0]!.seatKey).toBe("go:b");
  });
});

describe("planAllocation", () => {
  let counter = 0;
  const groupIds = () => `group-${(counter += 1)}`;
  const plan = (args: Parameters<typeof planAllocation>[0]) =>
    planAllocation({ newGroupId: groupIds, ...args });

  const oldest = seat({
    seatKey: "go:one",
    buyLeadId: "one",
    contactId: "c1",
    createdAt: "2026-09-10T09:00:00.000Z",
  });
  const middle = seat({
    seatKey: "go:two",
    buyLeadId: "two",
    contactId: "c2",
    createdAt: "2026-09-10T10:00:00.000Z",
  });
  const newest = seat({
    seatKey: "go:three",
    buyLeadId: "three",
    contactId: "c3",
    createdAt: "2026-09-10T11:00:00.000Z",
  });

  it("spreads two units down the queue instead of giving both to rank 1", () => {
    const result = plan({
      units: [unit({ id: "u1" }), unit({ id: "u2" })],
      seats: [oldest, middle, newest],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });

    expect(result.offers).toHaveLength(2);
    expect(result.offers.map((o) => o.seatKey)).toEqual(["go:one", "go:two"]);
    expect(result.offers.map((o) => o.rank)).toEqual([1, 2]);
  });

  it("lets a two-ticket buyer actually obtain two, as one group", () => {
    const result = plan({
      units: [unit({ id: "u1" }), unit({ id: "u2" })],
      seats: [seat({ ...oldest, quantity: 2 }), middle],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });

    expect(result.offers).toHaveLength(2);
    expect(new Set(result.offers.map((o) => o.seatKey))).toEqual(new Set(["go:one"]));
    // Same group id — accepting is all-or-nothing, so a buyer who needs a pair
    // never ends up paying for one of them.
    expect(new Set(result.offers.map((o) => o.groupId)).size).toBe(1);
  });

  it("caps a two-ticket buyer at two and passes the surplus down the queue", () => {
    const result = plan({
      units: [unit({ id: "u1" }), unit({ id: "u2" }), unit({ id: "u3" })],
      seats: [seat({ ...oldest, quantity: 2 }), middle],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });

    const bySeat = result.offers.reduce<Record<string, number>>((acc, o) => {
      acc[o.seatKey] = (acc[o.seatKey] ?? 0) + 1;
      return acc;
    }, {});
    expect(bySeat).toEqual({ "go:one": 2, "go:two": 1 });
  });

  it("offers a two-ticket buyer the single ticket that exists rather than skipping them", () => {
    const result = plan({
      units: [unit({ id: "u1" })],
      seats: [seat({ ...oldest, quantity: 2 }), middle],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]!.seatKey).toBe("go:one");
  });

  it("counts capacity a seat is already holding from an earlier pass", () => {
    const alreadyHeld = offer({ unitId: "other", seatKey: "go:one", status: "offered" });
    const result = plan({
      units: [unit({ id: "u1" })],
      seats: [oldest, middle],
      offers: [alreadyHeld],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers[0]!.seatKey).toBe("go:two");
  });

  it("offers the cheapest ticket first", () => {
    const result = plan({
      units: [unit({ id: "dear", priceEach: 45 }), unit({ id: "cheap", priceEach: 20 })],
      seats: [oldest],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]!.unitId).toBe("cheap");
  });

  it("leaves a unit alone while someone else's offer on it is live", () => {
    const live = offer({ unitId: "u1", seatKey: "go:two", expiresAt: at(15 * MINUTE) });
    const result = plan({
      units: [unit({ id: "u1" })],
      seats: [oldest, middle],
      offers: [live],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers).toHaveLength(0);
    expect(result.idle).toEqual([{ unitId: "u1", reason: "claimed" }]);
  });

  it("reallocates a unit whose offer expired but was never swept", () => {
    // The row still says `offered`; only the clock says otherwise. This is the
    // case that would deadlock if lazy expiry and the write path disagreed.
    const stale = offer({ unitId: "u1", seatKey: "go:one", expiresAt: at(-1 * MINUTE) });
    const result = plan({
      units: [unit({ id: "u1" })],
      seats: [oldest, middle],
      offers: [stale],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers).toHaveLength(1);
    // rank 1 ignored it once, so rank 1 now has a strike but is not yet dormant
    // — they are still eligible, and still first.
    expect(result.offers[0]!.seatKey).toBe("go:one");
  });

  it("skips sold and withdrawn units", () => {
    const result = plan({
      units: [unit({ id: "sold", status: "sold" }), unit({ id: "gone", status: "withdrawn" })],
      seats: [oldest],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers).toHaveLength(0);
    expect(result.idle.map((i) => i.reason)).toEqual(["not_available", "not_available"]);
  });

  it("does nothing quietly when no seat is eligible", () => {
    const result = plan({
      units: [unit({ id: "u1", priceEach: 40 })],
      seats: [seat({ ...oldest, maxPriceEach: 20 })],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers).toEqual([]);
    expect(result.idle).toEqual([{ unitId: "u1", reason: "no_eligible_seat" }]);
  });

  it("does nothing quietly when the waitlist is empty", () => {
    const result = plan({
      units: [unit({ id: "u1" })],
      seats: [],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers).toEqual([]);
    expect(result.broadcasts).toEqual([]);
    expect(result.idle).toEqual([{ unitId: "u1", reason: "no_eligible_seat" }]);
  });

  it("broadcasts instead of walking the queue once the budget is gone", () => {
    const ghost = offer({
      unitId: "u1",
      seatKey: "go:one",
      status: "expired_unpaid",
      offeredAt: at(-90 * MINUTE),
      respondedAt: at(-1 * MINUTE),
    });
    const result = plan({
      units: [unit({ id: "u1" })],
      seats: [oldest, middle, newest],
      offers: [ghost],
      now: NOW,
      doorsAt: FAR_DOORS,
    });

    expect(result.offers).toEqual([]);
    expect(result.broadcasts).toHaveLength(1);
    expect(result.broadcasts[0]!.mode).toBe("broadcast");
    // The ghost is dormant now; the other two hear about it.
    expect(result.broadcasts[0]!.seatKeys).toEqual(["go:two", "go:three"]);
  });

  it("holds nothing on a promise inside two hours of doors", () => {
    const result = plan({
      units: [unit({ id: "u1" })],
      seats: [oldest, middle],
      offers: [],
      now: NOW,
      doorsAt: new Date(NOW.getTime() + 90 * MINUTE),
    });
    expect(result.offers).toEqual([]);
    expect(result.broadcasts[0]!.mode).toBe("open");
    expect(result.broadcasts[0]!.seatKeys).toEqual(["go:one", "go:two"]);
  });

  it("stamps the shortened deadline on offers made near doors", () => {
    const doors = new Date(NOW.getTime() + 5 * HOUR);
    const result = plan({
      units: [unit({ id: "u1" })],
      seats: [oldest],
      offers: [],
      now: NOW,
      doorsAt: doors,
    });
    expect(result.offers[0]!.expiresAt).toBe(
      new Date(NOW.getTime() + MATCHING_POLICY.nearDoorsResponseWindowMs).toISOString(),
    );
  });

  it("never allocates a unit to the seat that is selling it", () => {
    const sellerSeat = seat({
      seatKey: "go:seller",
      buyLeadId: "seller-lead",
      contactId: "seller-contact",
      createdAt: "2026-09-01T00:00:00.000Z", // oldest, so rank 1
    });
    const result = plan({
      units: [unit({ id: "u1", sellerContactId: "seller-contact" })],
      seats: [sellerSeat, oldest],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]!.seatKey).toBe("go:one");
  });

  it("works from a classic member interest seat as well as a /go lead", () => {
    const classic = seat({
      seatKey: "classic:i-1",
      source: "classic",
      buyLeadId: null,
      classicInterestId: "i-1",
      contactId: null,
      memberId: "m-1",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    const result = plan({
      units: [unit({ id: "u1" })],
      seats: [classic, oldest],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers[0]).toMatchObject({
      seatKey: "classic:i-1",
      classicInterestId: "i-1",
      buyLeadId: null,
      rank: 1,
    });
  });

  it("keeps ranks on real positions — display padding is not part of the input", () => {
    // `listUnifiedQueueSeats` returns real seats only; fake front is added at
    // render time. Rank 1 here must be the oldest real seat, whatever the user
    // is shown as their number.
    const result = plan({
      units: [unit({ id: "u1" })],
      seats: [newest, oldest, middle],
      offers: [],
      now: NOW,
      doorsAt: FAR_DOORS,
    });
    expect(result.offers[0]!.rank).toBe(1);
    expect(result.offers[0]!.seatKey).toBe("go:one");
  });
});

describe("transitions", () => {
  it("allows the happy path and nothing that skips payment", () => {
    expect(canTransition("offered", "accepted")).toBe(true);
    expect(canTransition("accepted", "paid")).toBe(true);
    expect(canTransition("offered", "paid")).toBe(false);
  });

  it("freezes terminal statuses", () => {
    for (const from of ["declined", "expired_no_response", "expired_unpaid", "payment_failed", "withdrawn"] as OfferStatus[]) {
      expect(canTransition(from, "accepted")).toBe(false);
      expect(canTransition(from, "paid")).toBe(false);
    }
  });

  it("only lets a human resolve an ambiguous payment", () => {
    expect(canTransition("needs_review", "paid")).toBe(true);
    expect(canTransition("needs_review", "payment_failed")).toBe(true);
    // No auto-requeue: the money might still land.
    expect(canTransition("needs_review", "expired_unpaid")).toBe(false);
    expect(canTransition("needs_review", "declined")).toBe(false);
  });

  it("allows a confirmed payment to be reversed", () => {
    expect(canTransition("paid", "payment_failed")).toBe(true);
  });

  it("starts the payment clock on acceptance", () => {
    const result = applyTransition({ offer: offer(), to: "accepted", now: NOW, doorsAt: FAR_DOORS });
    expect(result).toEqual({
      ok: true,
      status: "accepted",
      paymentDueAt: new Date(NOW.getTime() + MATCHING_POLICY.paymentWindowMs).toISOString(),
    });
  });

  it("shortens the payment clock near doors", () => {
    const result = applyTransition({
      offer: offer(),
      to: "accepted",
      now: NOW,
      doorsAt: new Date(NOW.getTime() + 4 * HOUR),
    });
    expect(result).toMatchObject({
      paymentDueAt: new Date(NOW.getTime() + MATCHING_POLICY.nearDoorsPaymentWindowMs).toISOString(),
    });
  });

  it("refuses to accept an offer whose clock already ran out", () => {
    const stale = offer({ expiresAt: at(-1 * MINUTE) });
    expect(applyTransition({ offer: stale, to: "accepted", now: NOW, doorsAt: FAR_DOORS })).toEqual({
      ok: false,
      error: "Can't move an offer from expired_no_response to accepted.",
    });
  });

  it("refuses to mark an offer paid once its payment clock ran out", () => {
    const ghosted = offer({ status: "accepted", paymentDueAt: at(-1 * MINUTE) });
    expect(applyTransition({ offer: ghosted, to: "paid", now: NOW, doorsAt: FAR_DOORS })).toEqual({
      ok: false,
      error: "Can't move an offer from expired_unpaid to paid.",
    });
  });

  it("rejects a no-op transition rather than rewriting the row", () => {
    expect(applyTransition({ offer: offer(), to: "offered", now: NOW, doorsAt: FAR_DOORS })).toEqual({
      ok: false,
      error: "Offer is already offered.",
    });
  });

  it("sends a buyer to the front after a seller withdrawal, without requeueing the unit", () => {
    expect(withdrawalCompensation(offer({ seatKey: "go:one" }))).toEqual({
      requeueUnit: false,
      seatKey: "go:one",
      priority: "front",
    });
  });
});
