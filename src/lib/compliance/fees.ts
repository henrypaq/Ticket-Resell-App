/**
 * Platform fee model.
 *
 * CLAUDE_1 hard constraint 2: no fee may be labeled or structured as a
 * "transfer fee". What we charge is a flat, itemized service fee, always shown
 * as its own line separate from the ticket price. The label below is the only
 * place that string is defined — do not rename it to anything containing
 * "transfer" without a legal review.
 */
export const SERVICE_FEE_LABEL = "Service fee";

/** Flat, per-transaction, in CAD. Not a percentage of the ticket price. */
export const SERVICE_FEE_CAD = 2.49;

export type FeeBreakdown = {
  ticketPrice: number;
  serviceFee: number;
  serviceFeeLabel: string;
  total: number;
};

export function buildFeeBreakdown(ticketPrice: number): FeeBreakdown {
  const serviceFee = SERVICE_FEE_CAD;
  return {
    ticketPrice: round2(ticketPrice),
    serviceFee: round2(serviceFee),
    serviceFeeLabel: SERVICE_FEE_LABEL,
    total: round2(ticketPrice + serviceFee),
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
