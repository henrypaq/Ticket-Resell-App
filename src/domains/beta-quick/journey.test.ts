import { describe, expect, it } from "vitest";
import { buyerJourney, isWalletStage, sellerHasSale, sellerJourney } from "./journey";
import type { BuyerOfferSummary, GoActivityEntry, QuickWaitlistEntry } from "./shared";

function buyer(overrides: Partial<QuickWaitlistEntry> = {}): QuickWaitlistEntry {
  return {
    leadId: "11111111-1111-1111-1111-111111111111",
    eventSlug: "piknik",
    eventName: "Piknik",
    quantity: 1,
    position: 3,
    status: "new",
    createdAt: "2026-09-29T12:00:00.000Z",
    contactPhone: null,
    contactInstagram: null,
    activeOfferId: null,
    offers: [],
    ...overrides,
  };
}

function offer(overrides: Partial<BuyerOfferSummary> = {}): BuyerOfferSummary {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    status: "offered",
    priceEach: 20,
    offeredAt: "2026-09-29T12:00:00.000Z",
    expiresAt: "2026-09-29T12:10:00.000Z",
    paymentDueAt: null,
    buyerDeclaredSentAt: null,
    ticketTransferredAt: null,
    ...overrides,
  };
}

function seller(overrides: Partial<GoActivityEntry> = {}): GoActivityEntry {
  return {
    leadId: "33333333-3333-3333-3333-333333333333",
    intent: "sell",
    eventSlug: "piknik",
    eventName: "Piknik",
    quantity: 1,
    status: "new",
    paidEach: 20,
    askEach: 20,
    proceedsCad: null,
    netVsPaidCad: null,
    createdAt: "2026-09-29T12:00:00.000Z",
    ...overrides,
  };
}

describe("buyerJourney", () => {
  it("is waiting with no offers", () => {
    expect(buyerJourney(buyer()).stage).toBe("waiting");
  });

  it("walks a marketplace offer through held → pay → sent → confirmed", () => {
    expect(buyerJourney(buyer({ offers: [offer()] })).stage).toBe("held");
    expect(buyerJourney(buyer({ offers: [offer({ status: "accepted" })] })).stage).toBe("pay");
    expect(
      buyerJourney(
        buyer({ offers: [offer({ status: "accepted", buyerDeclaredSentAt: "2026-09-29T12:05:00Z" })] }),
      ).stage,
    ).toBe("payment_sent");
    const paid = buyerJourney(buyer({ status: "done", offers: [offer({ status: "paid" })] }));
    expect(paid.stage).toBe("confirmed");
    expect(paid.href).toBe("/offer/22222222-2222-2222-2222-222222222222");
  });

  it("ignores closed offers (the seat is back to waiting)", () => {
    expect(buyerJourney(buyer({ offers: [offer({ status: "expired_no_response" })] })).stage).toBe(
      "waiting",
    );
  });

  it("surfaces a fresh hold ahead of an already-paid ticket", () => {
    const j = buyerJourney(
      buyer({ offers: [offer({ id: "a", status: "paid" }), offer({ id: "b", status: "offered" })] }),
    );
    expect(j.stage).toBe("held");
    expect(j.offer?.id).toBe("b");
  });

  it("treats a delivered ticket as transferred until the buyer confirms it", () => {
    const delivered = buyer({ ticketForwardedAt: "2026-09-29T13:00:00Z", offers: [offer({ status: "paid" })] });
    expect(buyerJourney(delivered).stage).toBe("transferred");
    expect(buyerJourney({ ...delivered, buyerConfirmedReceivedAt: "2026-09-29T13:05:00Z" }).stage).toBe(
      "received",
    );
  });

  it("keeps fixed-price seats on the queue until payment is confirmed", () => {
    expect(buyerJourney(buyer({ buyerDeclaredSentAt: "x", paymentAmount: 18.8 })).stage).toBe("queue");
    expect(
      buyerJourney(buyer({ buyerDeclaredSentAt: "x", paymentRecordedAt: "y", paymentAmount: 18.8 })).stage,
    ).toBe("confirmed");
  });

  it("keeps waiting and queue seats out of the wallet", () => {
    expect(isWalletStage("waiting")).toBe(false);
    expect(isWalletStage("queue")).toBe(false);
    expect(isWalletStage("received")).toBe(false);
    expect(isWalletStage("confirmed")).toBe(true);
  });
});

describe("sellerJourney", () => {
  it("asks custody sellers to send the ticket first", () => {
    const cafe = seller({ eventSlug: "cafe-campus" });
    expect(sellerJourney(cafe)).toMatchObject({ stage: "send", step: 1, requiresCustody: true });
    expect(sellerJourney({ ...cafe, sellerTicketSentAt: "x" }).stage).toBe("checking");
    expect(sellerJourney({ ...cafe, sellerTicketSentAt: "x", ticketReceivedAt: "y" }).stage).toBe("live");
  });

  it("skips custody for other events", () => {
    expect(sellerJourney(seller())).toMatchObject({ stage: "live", step: 3, requiresCustody: false });
  });

  it("moves through claimed → sold → paid out", () => {
    expect(sellerJourney(seller({ claimedCount: 1 })).stage).toBe("claimed");
    expect(sellerJourney(seller({ soldCount: 1 })).stage).toBe("sold");
    expect(sellerJourney(seller({ soldCount: 2, payoutReleasedCount: 1 })).stage).toBe("sold");
    expect(sellerJourney(seller({ soldCount: 1, payoutReleasedCount: 1 }))).toMatchObject({
      stage: "paid_out",
      step: 5,
    });
  });

  it("a sale outranks custody state", () => {
    expect(sellerJourney(seller({ eventSlug: "cafe-campus", soldCount: 1 })).stage).toBe("sold");
  });

  it("flags any listing mid-sale so it can't be swept as unsold", () => {
    expect(sellerHasSale(seller())).toBe(false);
    expect(sellerHasSale(seller({ claimedCount: 1 }))).toBe(true);
    expect(sellerHasSale(seller({ saleStage: "awaiting_transfer" }))).toBe(true);
  });
});
