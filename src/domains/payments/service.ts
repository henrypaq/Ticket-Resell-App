import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getListingById } from "@/domains/listings/data";
import { getEventById } from "@/domains/events/data";
import { buildFeeBreakdown } from "@/lib/compliance/fees";
import { stripeConfigured } from "@/lib/env";
import { getStripe, toCents } from "@/lib/stripe/client";
import { logEvent } from "@/lib/analytics/log";
import { releaseCore } from "./release";
import type { MinimalEventRow, PurchasedTicketRow } from "@/lib/types";

export const PAYMENTS_UNCONFIGURED =
  "Payments aren't configured on this environment yet. Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local.";

export type StartPurchaseResult =
  | { ok: true; clientSecret: string; transactionId: string; total: number }
  | { ok: false; error: string; code: string };

export const startPurchaseSchema = z.object({
  listingId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(128),
});

/**
 * Phase 1 purchase: charge the buyer into the *platform's* Stripe balance and
 * hold it. No transfer to the seller happens here — that is a separate,
 * admin-triggered Transfer from the admin console (CLAUDE.md § Phase 1, manual
 * escrow). Phase 2 replaces the trigger, not this mechanism.
 *
 * Deliberately does NOT use transfer_data / on_behalf_of: those would settle
 * straight to the seller, which is exactly what "held" must not do.
 */
export async function startPurchase(
  buyer: { id: string },
  input: z.infer<typeof startPurchaseSchema>,
): Promise<StartPurchaseResult> {
  if (!stripeConfigured()) {
    return { ok: false, code: "payments_unconfigured", error: PAYMENTS_UNCONFIGURED };
  }

  const listing = await getListingById(input.listingId);
  if (!listing) return { ok: false, code: "not_found", error: "That listing no longer exists." };
  if (listing.removed_at) {
    return { ok: false, code: "unavailable", error: "That listing has been removed." };
  }
  if (listing.seller_id === buyer.id) {
    return { ok: false, code: "own_listing", error: "You can't buy your own listing." };
  }
  if (listing.status !== "active") {
    return { ok: false, code: "unavailable", error: "That ticket is no longer available." };
  }

  const event = await getEventById(listing.event_id);
  if (!event || event.status !== "resale_enabled") {
    return { ok: false, code: "event_not_enabled", error: "This event isn't open for resale." };
  }

  const fees = buildFeeBreakdown(Number(listing.price));
  const admin = createAdminClient();
  const stripe = getStripe();

  // Reserve the listing first, conditional on it still being active, so two
  // buyers can't both be charged for one ticket.
  const { data: reserved, error: reserveError } = await admin
    .from("listings")
    .update({ status: "reserved", reserved_by: buyer.id, reserved_at: new Date().toISOString() })
    .eq("id", listing.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (reserveError) throw reserveError;
  if (!reserved) {
    return { ok: false, code: "unavailable", error: "Someone just bought that ticket." };
  }

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: toCents(fees.total),
        currency: "cad",
        // Funds settle into the platform balance and stay there until an admin
        // releases them.
        capture_method: "automatic",
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: {
          listing_id: listing.id,
          event_id: listing.event_id,
          buyer_id: buyer.id,
          seller_id: listing.seller_id,
          ticket_price: String(fees.ticketPrice),
          service_fee: String(fees.serviceFee),
        },
      },
      // Idempotency on every payment-mutating call (SECURITY.md).
      { idempotencyKey: input.idempotencyKey },
    );

    const { data: transaction, error: txError } = await admin
      .from("transactions")
      .insert({
        listing_id: listing.id,
        buyer_id: buyer.id,
        amount: fees.ticketPrice,
        fee_amount: fees.serviceFee,
        escrow_status: "held",
        verification_status: "pending_admin_review",
        idempotency_key: input.idempotencyKey,
        stripe_payment_intent_id: intent.id,
      })
      .select("id")
      .single();

    if (txError) throw txError;

    await logEvent({
      type: "purchase_initiated",
      userId: buyer.id,
      eventRefId: listing.event_id,
      listingRefId: listing.id,
      metadata: { amount: fees.ticketPrice, fee_amount: fees.serviceFee },
    });

    return {
      ok: true,
      clientSecret: intent.client_secret ?? "",
      transactionId: transaction.id,
      total: fees.total,
    };
  } catch (err) {
    // Release the reservation so a failed charge doesn't strand the listing.
    await admin
      .from("listings")
      .update({ status: "active", reserved_by: null, reserved_at: null })
      .eq("id", listing.id)
      .eq("status", "reserved");
    throw err;
  }
}

export type BuyerActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Fetches a held transaction the way both confirmEntry and openDispute need
 * it: the buyer's own row, still held. Does NOT gate on the event having
 * happened — a buyer can spot a problem (a fake ticket, a seller going dark)
 * before the event too, and must be able to dispute then. Only confirming
 * entry implies the event happened; that check lives in confirmEntry alone.
 */
async function getOwnHeldTransaction(buyerId: string, transactionId: string) {
  const admin = createAdminClient();
  const { data: tx, error } = await admin
    .from("transactions")
    .select("id, buyer_id, escrow_status, listing_id, listing:listings(event_id)")
    .eq("id", transactionId)
    .maybeSingle();
  if (error) throw error;
  if (!tx || tx.buyer_id !== buyerId) return { ok: false as const, error: "Transaction not found." };
  if (tx.escrow_status !== "held") {
    return { ok: false as const, error: `That payment is ${tx.escrow_status}, not held.` };
  }

  const listing = tx.listing as unknown as { event_id: string };
  return { ok: true as const, eventId: listing.event_id };
}

/**
 * The Tier B release signal (CLAUDE.md § Phase 2: "buyer confirms entry").
 * Records the confirmation independently of whether the Transfer itself
 * succeeds — e.g. a seller with no payout account yet — so the auto-release
 * sweep can retry it later without the buyer reconfirming (it does not filter
 * on buyer_confirmed_at — see domains/payments/auto-release.ts).
 */
export async function confirmEntry(buyerId: string, transactionId: string): Promise<BuyerActionResult> {
  if (!stripeConfigured()) return { ok: false, error: PAYMENTS_UNCONFIGURED };

  const check = await getOwnHeldTransaction(buyerId, transactionId);
  if (!check.ok) return check;

  // Confirming entry only makes sense once the event has actually happened.
  const event = await getEventById(check.eventId);
  if (!event) return { ok: false, error: "Event not found." };
  if (new Date(event.starts_at) > new Date()) {
    return { ok: false, error: "This event hasn't happened yet." };
  }

  const admin = createAdminClient();
  await admin
    .from("transactions")
    .update({ buyer_confirmed_at: new Date().toISOString() })
    .eq("id", transactionId)
    .is("buyer_confirmed_at", null);

  const result = await releaseCore(transactionId, { type: "buyer_confirmation", buyerId });
  if (result.ok) return result;

  // releaseCore's failure text is written for an admin (mentions Connect
  // onboarding, editing a profile column) — a buyer just needs to know their
  // confirmation was recorded and the payout is pending. The likely cause
  // today (no seller payout account) is the common case, not an edge case, so
  // this warrants a warn log the same way other swallowed failures in this
  // codebase do (e.g. match_notify_failed in listings/service.ts) — the
  // auto-release sweep will retry it, but someone should be able to see why.
  console.warn(
    JSON.stringify({
      level: "warn",
      msg: "confirm_entry_release_failed",
      transaction_id: transactionId,
      error: result.error,
    }),
  );
  return {
    ok: true,
    message: "Got it — your confirmation is recorded. The payout to the seller is still processing.",
  };
}

export const openDisputeSchema = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().trim().min(1).max(2000),
});

/**
 * The alternative to confirming: routes the transaction to escrow_status =
 * 'disputed' for manual admin resolution — the "timeout/dispute path" CLAUDE.md
 * § Phase 2 pairs with the automated release trigger. Never auto-refunds;
 * only an admin releases or refunds from here (domains/admin/service.ts).
 */
export async function openDispute(
  buyerId: string,
  input: z.infer<typeof openDisputeSchema>,
): Promise<BuyerActionResult> {
  const check = await getOwnHeldTransaction(buyerId, input.transactionId);
  if (!check.ok) return check;

  const admin = createAdminClient();
  await admin
    .from("transactions")
    .update({
      escrow_status: "disputed",
      dispute_reason: input.reason,
      dispute_opened_at: new Date().toISOString(),
      verification_status: "disputed_by_buyer",
    })
    .eq("id", input.transactionId);

  await logEvent({
    type: "purchase_disputed",
    userId: buyerId,
    metadata: { transaction_id: input.transactionId, reason: input.reason },
  });

  return { ok: true, message: "Reported. An admin will review it and reach out." };
}

export async function listPurchasedTicketsForBuyer(buyerId: string): Promise<PurchasedTicketRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, listing:listings(event:events(id, name, venue, city, starts_at, flyer_url))")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { listing, ...transaction } = row as typeof row & { listing: { event: MinimalEventRow } };
    return { ...transaction, event: listing.event } as PurchasedTicketRow;
  });
}
