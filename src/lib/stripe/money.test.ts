import { describe, expect, it } from "vitest";
import { toCents, fromCents } from "./money";

describe("currency conversion", () => {
  it("converts CAD to cents without floating point drift", () => {
    expect(toCents(22.49)).toBe(2249);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(19.99)).toBe(1999);
  });

  it("round-trips cents back to CAD", () => {
    expect(fromCents(2249)).toBe(22.49);
    expect(fromCents(10)).toBe(0.1);
  });

  it("matches the fee breakdown total exactly, in cents", () => {
    // Regression guard: this is the amount actually sent to Stripe.
    const ticketPrice = 28;
    const serviceFee = 2.49;
    expect(toCents(ticketPrice) + toCents(serviceFee)).toBe(toCents(ticketPrice + serviceFee));
  });
});
