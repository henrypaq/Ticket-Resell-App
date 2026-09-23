"use server";

import { confirmSellerPayoutReceived } from "@/domains/beta-matching/service";

export type PayoutConfirmState = { ok?: true; error?: string; message?: string };

/**
 * Seller confirms Interac landed. Offer id from the email link is the
 * capability token — no cookie required so inbox → phone works.
 */
export async function sellerConfirmPayoutAction(
  offerId: string,
): Promise<PayoutConfirmState> {
  if (!/^[0-9a-f-]{36}$/i.test(offerId)) {
    return { error: "Invalid payout link." };
  }
  const result = await confirmSellerPayoutReceived(offerId);
  if (!result.ok) return { error: result.error };
  return {
    ok: true,
    message: "Thanks — we’ve marked your payout as received.",
  };
}
