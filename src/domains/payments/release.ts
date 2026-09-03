import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, toCents } from "@/lib/stripe/client";
import { logEvent } from "@/lib/analytics/log";

/**
 * The one place a held payment actually becomes a Transfer to the seller.
 *
 * CLAUDE.md § Phase 2: "Phase 2 doesn't rebuild [the escrow mechanism] — it
 * replaces the trigger." This is that: the mechanism (charge into the
 * platform balance, hold, then a separate Transfer) is unchanged from Phase 1;
 * what changes is *who* triggers it — an admin from the console, a buyer
 * confirming entry, or an unattended timeout. All three funnel through here so
 * there is exactly one Transfer code path to reason about and test, and admin
 * auditing (writing to admin_actions) stays the caller's job — only an admin
 * actor has an admin_id to attribute it to.
 */
export type ReleaseActor =
  | { type: "admin"; adminId: string }
  | { type: "buyer_confirmation"; buyerId: string }
  | { type: "auto_timeout" };

export type ReleaseResult = { ok: true; message: string } | { ok: false; error: string };

const VERIFICATION_STATUS_BY_ACTOR: Record<ReleaseActor["type"], string> = {
  admin: "released_by_admin",
  buyer_confirmation: "released_buyer_confirmed",
  auto_timeout: "released_auto_timeout",
};

export async function releaseCore(
  transactionId: string,
  actor: ReleaseActor,
  note?: string,
): Promise<ReleaseResult> {
  const admin = createAdminClient();

  const { data: tx, error } = await admin
    .from("transactions")
    .select("id, amount, escrow_status, stripe_payment_intent_id, listing_id")
    .eq("id", transactionId)
    .maybeSingle();

  if (error) throw error;
  if (!tx) return { ok: false, error: "Transaction not found." };

  // Only an admin can release out of a dispute — a buyer confirmation or an
  // unattended timeout must never resolve a transaction someone flagged as a
  // problem; that's what routes disputes to the manual admin path.
  const releasable =
    tx.escrow_status === "held" || (tx.escrow_status === "disputed" && actor.type === "admin");
  if (!releasable) {
    return { ok: false, error: `That payment is ${tx.escrow_status}, not held.` };
  }

  const { data: listing } = await admin
    .from("listings")
    .select("seller_id, event_id")
    .eq("id", tx.listing_id)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };

  const { data: seller } = await admin
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", listing.seller_id)
    .maybeSingle();

  if (!seller?.stripe_account_id) {
    return {
      ok: false,
      error:
        "The seller has no connected payout account, so funds can't be transferred yet. Connect onboarding isn't built yet — refund the buyer, or add the account id to the seller's profile.",
    };
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(tx.stripe_payment_intent_id!);
  const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : undefined;

  const transfer = await stripe.transfers.create(
    {
      amount: toCents(Number(tx.amount)),
      currency: "cad",
      destination: seller.stripe_account_id,
      source_transaction: chargeId,
      metadata: { transaction_id: tx.id, release_trigger: actor.type },
    },
    // Idempotent per transaction — a transaction can only ever be released
    // once, whichever actor triggers it, so the key doesn't need to vary by
    // actor.
    { idempotencyKey: `release_${tx.id}` },
  );

  await admin
    .from("transactions")
    .update({
      escrow_status: "released",
      released_by: actor.type === "admin" ? actor.adminId : null,
      released_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      stripe_transfer_id: transfer.id,
      stripe_charge_id: chargeId ?? null,
      admin_note: note ?? null,
      verification_status: VERIFICATION_STATUS_BY_ACTOR[actor.type],
    })
    .eq("id", tx.id);

  await admin.from("listings").update({ status: "sold" }).eq("id", tx.listing_id);

  await admin.from("notifications").insert({
    user_id: listing.seller_id,
    type: "payment_released",
    title: "Your payment has been released",
    body: "The funds for your ticket are on their way to your payout account.",
    event_ref_id: listing.event_id,
    listing_ref_id: tx.listing_id,
  });

  await logEvent({
    type: "purchase_completed",
    eventRefId: listing.event_id,
    listingRefId: tx.listing_id,
    metadata: { amount: Number(tx.amount), release_trigger: actor.type },
  });

  return {
    ok: true,
    message:
      actor.type === "admin" ? "Released to the seller." : "Confirmed — funds released to the seller.",
  };
}
