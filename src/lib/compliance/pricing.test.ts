import { describe, expect, it } from "vitest";
import { resolvePriceCap, validateListingPrice } from "./pricing";
import { buildFeeBreakdown, SERVICE_FEE_LABEL } from "./fees";
import { buildDisclosureSnapshot } from "./disclosure";

// ARCHITECTURE.md is explicit that the hard-constraint tests must try to
// *violate* the rule and confirm rejection, not just walk the happy path.

const FACE_VALUE = 40;

describe("resale price cap", () => {
  it("defaults the cap to face value when no authorization exists", () => {
    expect(resolvePriceCap({ faceValue: FACE_VALUE, authorizedMaxResalePrice: null })).toEqual({
      cap: 40,
      capSource: "face_value",
    });
  });

  it("allows a listing at exactly face value", () => {
    const r = validateListingPrice(40, { faceValue: FACE_VALUE, authorizedMaxResalePrice: null });
    expect(r.ok).toBe(true);
  });

  it("allows a listing below face value", () => {
    expect(validateListingPrice(25, { faceValue: FACE_VALUE, authorizedMaxResalePrice: null }).ok).toBe(true);
  });

  it("REJECTS a listing one cent above face value", () => {
    const r = validateListingPrice(40.01, { faceValue: FACE_VALUE, authorizedMaxResalePrice: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("RESALE_PRICE_CAP_EXCEEDED");
  });

  it("REJECTS an obvious scalping price", () => {
    const r = validateListingPrice(400, { faceValue: FACE_VALUE, authorizedMaxResalePrice: null });
    expect(r.ok).toBe(false);
  });

  it("REJECTS a negative price", () => {
    const r = validateListingPrice(-5, { faceValue: FACE_VALUE, authorizedMaxResalePrice: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("PRICE_NEGATIVE");
  });

  it("REJECTS NaN", () => {
    const r = validateListingPrice(Number.NaN, { faceValue: FACE_VALUE, authorizedMaxResalePrice: null });
    expect(r.ok).toBe(false);
  });

  it("raises the cap ONLY when an EventAuthorization is present", () => {
    const withAuth = validateListingPrice(60, {
      faceValue: FACE_VALUE,
      authorizedMaxResalePrice: 65,
    });
    expect(withAuth.ok).toBe(true);

    const withoutAuth = validateListingPrice(60, {
      faceValue: FACE_VALUE,
      authorizedMaxResalePrice: null,
    });
    expect(withoutAuth.ok).toBe(false);
  });

  it("still enforces the authorized ceiling as a ceiling", () => {
    const r = validateListingPrice(70, { faceValue: FACE_VALUE, authorizedMaxResalePrice: 65 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cap).toBe(65);
  });

  it("honours an authorization that is BELOW face value", () => {
    const r = validateListingPrice(35, { faceValue: FACE_VALUE, authorizedMaxResalePrice: 30 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cap).toBe(30);
  });
});

describe("fees", () => {
  it("is a flat itemized service fee, never a transfer fee", () => {
    const fees = buildFeeBreakdown(30);
    expect(SERVICE_FEE_LABEL.toLowerCase()).not.toContain("transfer");
    expect(fees.serviceFeeLabel.toLowerCase()).not.toContain("transfer");
    expect(fees.ticketPrice).toBe(30);
    expect(fees.total).toBe(32.49);
  });

  it("does not scale the fee with ticket price", () => {
    expect(buildFeeBreakdown(10).serviceFee).toBe(buildFeeBreakdown(500).serviceFee);
  });
});

describe("disclosure snapshot", () => {
  const event = {
    id: "e1",
    name: "Sous-Sol",
    venue: "Stereo",
    city: "Montreal",
    starts_at: "2026-09-05T23:00:00Z",
    original_price: 32,
    verification_tier: "A" as const,
    source_platform: "dice",
  };

  it("discloses everything hard constraint 3 requires", () => {
    const snap = buildDisclosureSnapshot({
      event,
      listingPrice: 28,
      authorizedMaxResalePrice: null,
    });

    expect(snap.isResale).toBe(true);
    expect(snap.originalTicketPrice).toBe(32);
    expect(snap.event.venue).toBe("Stereo");
    expect(snap.fees.serviceFee).toBeGreaterThan(0);
    expect(snap.fees.total).toBe(30.49);
    expect(snap.priceCap).toBe(32);
    expect(snap.priceCapSource).toBe("face_value");
  });
});
