import { SERVICE_FEE_CAD, round2 } from "@/lib/compliance/fees";
import type { BetaEvent } from "@/lib/beta-events";

/**
 * Itemized totals for predetermined-price checkout.
 * `fixedPriceEach` is the net ticket after any discount.
 */
export function fixedPriceBreakdown(event: BetaEvent, quantity: number) {
  const qty = Math.max(1, Math.min(20, Math.floor(quantity) || 1));
  const netEach = event.fixedPriceEach ?? 0;
  const listEach = event.listPriceEach ?? netEach;
  const discountEach =
    event.discountEach != null
      ? event.discountEach
      : listEach > netEach
        ? round2(listEach - netEach)
        : 0;
  const feeEach = event.serviceFeeEach ?? SERVICE_FEE_CAD;
  const showDiscount = discountEach > 0 && listEach > netEach;

  const listSubtotal = round2(listEach * qty);
  const discountTotal = round2(discountEach * qty);
  const ticketsNet = round2(netEach * qty);
  const feesTotal = round2(feeEach * qty);
  const grandTotal = round2(ticketsNet + feesTotal);

  return {
    qty,
    netEach,
    listEach,
    discountEach,
    feeEach,
    showDiscount,
    discountLabel: event.discountLabel?.trim() || null,
    listSubtotal,
    discountTotal,
    ticketsNet,
    feesTotal,
    grandTotal,
  };
}
