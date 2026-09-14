import { describe, expect, it } from "vitest";
import {
  MATCHING_DEFAULTS,
  exclusivityBudgetExhausted,
  lazyExpiryStatus,
  matchingModeAt,
  nextAllocationAction,
  offerOffMarketMs,
  partialOfferCount,
  paymentDeadline,
  rankOfSeat,
  responseDeadline,
  seatEligibleForOffer,
  shouldGoDormant,
} from "./policy";

const NOW = new Date("2026-09-14T20:00:00.000Z");

describe("matchingModeAt", () => {
  it("defaults to exclusive when doors are unknown", () => {
    expect(matchingModeAt(NOW, null)).toBe("exclusive");
  });

  it("stays exclusive far from doors", () => {
    const doors = new Date(NOW.getTime() + 12 * 60 * 60_000);
    expect(matchingModeAt(NOW, doors)).toBe("exclusive");
  });

  it("shortens inside 6h of doors", () => {
    const doors = new Date(NOW.getTime() + 5 * 60 * 60_000);
    expect(matchingModeAt(NOW, doors)).toBe("short_window");
  });

  it("opens inside 2h of doors (including past doors)", () => {
    expect(matchingModeAt(NOW, new Date(NOW.getTime() + 90 * 60_000))).toBe("open");
    expect(matchingModeAt(NOW, new Date(NOW.getTime() - 60_000))).toBe("open");
  });
});

describe("clocks", () => {
  it("uses the default response window in exclusive mode", () => {
    const d = responseDeadline({ now: NOW, mode: "exclusive" });
    expect(d.getTime() - NOW.getTime()).toBe(MATCHING_DEFAULTS.responseMs);
  });

  it("collapses the response window in short_window mode", () => {
    const d = responseDeadline({ now: NOW, mode: "short_window" });
    expect(d.getTime() - NOW.getTime()).toBe(MATCHING_DEFAULTS.shortResponseMs);
  });

  it("refuses a payment hold in open mode", () => {
    expect(paymentDeadline({ now: NOW, mode: "open" })).toBeNull();
  });

  it("sets a payment clock when exclusive", () => {
    const d = paymentDeadline({ now: NOW, mode: "exclusive" });
    expect(d).not.toBeNull();
    expect(d!.getTime() - NOW.getTime()).toBe(MATCHING_DEFAULTS.paymentMs);
  });
});

describe("lazyExpiryStatus", () => {
  it("does not expire a live offer before its clock", () => {
    expect(
      lazyExpiryStatus(
        {
          status: "offered",
          offeredAt: NOW,
          expiresAt: new Date(NOW.getTime() + 60_000),
          paymentDueAt: null,
        },
        NOW,
      ),
    ).toBeNull();
  });

  it("expires silence at the response clock", () => {
    expect(
      lazyExpiryStatus(
        {
          status: "offered",
          offeredAt: NOW,
          expiresAt: NOW,
          paymentDueAt: null,
        },
        NOW,
      ),
    ).toBe("expired_no_response");
  });

  it("expires an unpaid accept at the payment clock", () => {
    expect(
      lazyExpiryStatus(
        {
          status: "accepted",
          offeredAt: NOW,
          expiresAt: new Date(NOW.getTime() + 60_000),
          paymentDueAt: NOW,
        },
        NOW,
      ),
    ).toBe("expired_unpaid");
  });

  it("never auto-expires needs_review (money may still land)", () => {
    expect(
      lazyExpiryStatus(
        {
          status: "needs_review",
          offeredAt: NOW,
          expiresAt: new Date(NOW.getTime() - 60_000),
          paymentDueAt: new Date(NOW.getTime() - 60_000),
        },
        NOW,
      ),
    ).toBeNull();
  });
});

describe("exclusivityBudgetExhausted", () => {
  it("trips on rank count", () => {
    expect(
      exclusivityBudgetExhausted({
        spentMs: 0,
        ranksUsed: MATCHING_DEFAULTS.exclusivityMaxRanks,
      }),
    ).toBe(true);
  });

  it("trips on wall-clock off-market time", () => {
    expect(
      exclusivityBudgetExhausted({
        spentMs: MATCHING_DEFAULTS.exclusivityBudgetMs,
        ranksUsed: 1,
      }),
    ).toBe(true);
  });

  it("stays open under both limits", () => {
    expect(exclusivityBudgetExhausted({ spentMs: 10_000, ranksUsed: 1 })).toBe(false);
  });
});

describe("offerOffMarketMs", () => {
  it("charges an accepted-then-ghosted hold through the payment clock", () => {
    const offeredAt = NOW;
    const paymentDueAt = new Date(NOW.getTime() + 90 * 60_000);
    const ms = offerOffMarketMs(
      {
        status: "expired_unpaid",
        offeredAt,
        expiresAt: new Date(NOW.getTime() + 45 * 60_000),
        paymentDueAt,
      },
      new Date(NOW.getTime() + 2 * 60 * 60_000),
    );
    expect(ms).toBe(90 * 60_000);
  });
});

describe("seatEligibleForOffer", () => {
  const base = {
    seatKey: "go:1",
    quantity: 2,
    maxPriceEach: null as number | null,
    unitPriceEach: 40,
    liveOfferCount: 0,
    dormant: false,
    isSeller: false,
    declinedAtOrAbove: [] as number[],
  };

  it("allows an eligible seat", () => {
    expect(seatEligibleForOffer(base)).toEqual({ ok: true });
  });

  it("REJECTS dormant seats", () => {
    expect(seatEligibleForOffer({ ...base, dormant: true })).toEqual({
      ok: false,
      reason: "dormant",
    });
  });

  it("REJECTS the seller", () => {
    expect(seatEligibleForOffer({ ...base, isSeller: true })).toEqual({
      ok: false,
      reason: "seller",
    });
  });

  it("REJECTS when the seat already holds its quantity", () => {
    expect(seatEligibleForOffer({ ...base, liveOfferCount: 2 })).toEqual({
      ok: false,
      reason: "seat_cap",
    });
  });

  it("REJECTS prices above the buyer's ceiling", () => {
    expect(seatEligibleForOffer({ ...base, maxPriceEach: 35, unitPriceEach: 40 })).toEqual({
      ok: false,
      reason: "price_ceiling",
    });
  });

  it("allows a price equal to the ceiling", () => {
    expect(seatEligibleForOffer({ ...base, maxPriceEach: 40, unitPriceEach: 40 })).toEqual({
      ok: true,
    });
  });

  it("REJECTS a price the seat already declined at or above", () => {
    expect(seatEligibleForOffer({ ...base, declinedAtOrAbove: [40] })).toEqual({
      ok: false,
      reason: "declined_price",
    });
  });
});

describe("partialOfferCount", () => {
  it("offers a partial fill instead of skipping a group seat", () => {
    expect(partialOfferCount({ seatQuantity: 2, liveOfferCount: 0, freeUnits: 1 })).toBe(1);
  });

  it("never oversells past the seat's ask", () => {
    expect(partialOfferCount({ seatQuantity: 1, liveOfferCount: 0, freeUnits: 3 })).toBe(1);
  });

  it("accounts for live holds already on the seat", () => {
    expect(partialOfferCount({ seatQuantity: 2, liveOfferCount: 1, freeUnits: 5 })).toBe(1);
  });
});

describe("shouldGoDormant", () => {
  it("dormants after two no-response expiries (count includes this event)", () => {
    expect(
      shouldGoDormant({ event: "expired_no_response", noResponseStrikes: 2, unpaidStrikes: 0 }),
    ).toBe(true);
  });

  it("does not dormant on the first no-response", () => {
    expect(
      shouldGoDormant({ event: "expired_no_response", noResponseStrikes: 1, unpaidStrikes: 0 }),
    ).toBe(false);
  });

  it("dormants on a single unpaid expiry (expensive failure)", () => {
    expect(
      shouldGoDormant({ event: "expired_unpaid", noResponseStrikes: 0, unpaidStrikes: 1 }),
    ).toBe(true);
  });
});

describe("nextAllocationAction", () => {
  it("advances to the next rank after a cheap decline while budget remains", () => {
    expect(
      nextAllocationAction({
        terminalStatus: "declined",
        spendAfter: { spentMs: 5_000, ranksUsed: 1 },
        mode: "exclusive",
      }),
    ).toBe("next_rank");
  });

  it("opens when exclusivity budget is exhausted", () => {
    expect(
      nextAllocationAction({
        terminalStatus: "expired_no_response",
        spendAfter: {
          spentMs: MATCHING_DEFAULTS.exclusivityBudgetMs,
          ranksUsed: 1,
        },
        mode: "exclusive",
      }),
    ).toBe("open");
  });

  it("stays open near doors", () => {
    expect(
      nextAllocationAction({
        terminalStatus: "declined",
        spendAfter: { spentMs: 0, ranksUsed: 0 },
        mode: "open",
      }),
    ).toBe("open");
  });

  it("stops on paid or needs_review (no auto-requeue once money may move)", () => {
    expect(
      nextAllocationAction({
        terminalStatus: "paid",
        spendAfter: { spentMs: 0, ranksUsed: 1 },
        mode: "exclusive",
      }),
    ).toBe("stop");
    expect(
      nextAllocationAction({
        terminalStatus: "needs_review",
        spendAfter: { spentMs: 0, ranksUsed: 1 },
        mode: "exclusive",
      }),
    ).toBe("stop");
  });
});

describe("rankOfSeat", () => {
  it("uses 1-based real-seat rank only — fake-front padding never enters the seat list", () => {
    // Display `#N` may add ops fake-front; allocator input is real seats only.
    const seats = [{ key: "go:a" }, { key: "classic:b" }, { key: "go:c" }];
    expect(rankOfSeat(seats, "go:a")).toBe(1);
    expect(rankOfSeat(seats, "classic:b")).toBe(2);
    expect(rankOfSeat(seats, "go:c")).toBe(3);
    expect(rankOfSeat(seats, "missing")).toBeNull();
  });
});
