import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { stripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { logEvent } from "@/lib/analytics/log";
import { PAYMENTS_UNCONFIGURED } from "@/domains/payments/service";
import { releaseCore } from "@/domains/payments/release";
import type { AdminActionType, EventRow, ListingRow, TransactionRow } from "@/lib/types";

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Records every admin action — who, when, what — per CLAUDE.md's AdminAction
 * entity and SECURITY.md § authorization. Called inside each mutation below
 * rather than by the callers, so an action can't be performed without being
 * logged.
 */
async function recordAction(input: {
  adminId: string;
  actionType: AdminActionType;
  targetType: string;
  targetId: string;
  notes?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_actions").insert({
    admin_id: input.adminId,
    action_type: input.actionType,
    target_type: input.targetType,
    target_id: input.targetId,
    notes: input.notes ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Event approval queue
// ---------------------------------------------------------------------------

export async function listPendingEvents(): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .in("status", ["pending", "discoverable"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export async function approveEvent(
  adminId: string,
  eventId: string,
  opts: { makeResaleEnabled: boolean; note?: string },
): Promise<AdminResult> {
  const admin = createAdminClient();
  const status = opts.makeResaleEnabled ? "resale_enabled" : "discoverable";

  const { data, error } = await admin
    .from("events")
    .update({
      status,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      review_note: opts.note ?? null,
      // An admin who approves for resale has, by doing so, verified the price.
      ...(opts.makeResaleEnabled ? { price_source: "admin_verified" as const } : {}),
    })
    .eq("id", eventId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, error: "Event not found." };

  await recordAction({
    adminId,
    actionType: "event_approved",
    targetType: "event",
    targetId: eventId,
    notes: `→ ${status}${opts.note ? ` · ${opts.note}` : ""}`,
  });

  return { ok: true, message: opts.makeResaleEnabled ? "Approved for resale." : "Made discoverable only." };
}

export async function rejectEvent(
  adminId: string,
  eventId: string,
  note: string,
): Promise<AdminResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .update({ status: "rejected", approved_by: adminId, approved_at: new Date().toISOString(), review_note: note })
    .eq("id", eventId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, error: "Event not found." };

  await recordAction({
    adminId,
    actionType: "event_rejected",
    targetType: "event",
    targetId: eventId,
    notes: note,
  });
  return { ok: true, message: "Rejected." };
}

// ---------------------------------------------------------------------------
// Listing moderation — reactive, not a pre-approval gate. Listings go live
// immediately; admins can flag or remove them afterwards.
// ---------------------------------------------------------------------------

export async function listAllListings(): Promise<ListingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ListingRow[];
}

export async function flagListing(
  adminId: string,
  listingId: string,
  reason: string,
): Promise<AdminResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listings")
    .update({ flagged_at: new Date().toISOString(), flagged_reason: reason })
    .eq("id", listingId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "Listing not found." };

  await recordAction({
    adminId,
    actionType: "listing_flagged",
    targetType: "listing",
    targetId: listingId,
    notes: reason,
  });
  return { ok: true, message: "Flagged." };
}

export async function unflagListing(adminId: string, listingId: string): Promise<AdminResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listings")
    .update({ flagged_at: null, flagged_reason: null })
    .eq("id", listingId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "Listing not found." };

  await recordAction({
    adminId,
    actionType: "listing_unflagged",
    targetType: "listing",
    targetId: listingId,
  });
  return { ok: true, message: "Flag cleared." };
}

export async function removeListing(
  adminId: string,
  listingId: string,
  reason: string,
): Promise<AdminResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listings")
    .update({ removed_at: new Date().toISOString(), status: "cancelled", flagged_reason: reason })
    .eq("id", listingId)
    .select("id, seller_id, event_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "Listing not found." };

  await admin.from("notifications").insert({
    user_id: data.seller_id,
    type: "listing_removed",
    title: "Your listing was removed",
    body: reason,
    event_ref_id: data.event_id,
    listing_ref_id: listingId,
  });

  await recordAction({
    adminId,
    actionType: "listing_removed",
    targetType: "listing",
    targetId: listingId,
    notes: reason,
  });
  return { ok: true, message: "Listing removed and the seller notified." };
}

// ---------------------------------------------------------------------------
// Payment approval — the manual release/refund queue behind Phase 1's escrow.
// ---------------------------------------------------------------------------

export async function listHeldTransactions(): Promise<TransactionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as TransactionRow[];
}

/**
 * Release: transfer the ticket price from the platform balance to the seller's
 * connected account. The service fee stays with the platform, which is why this
 * is a separate Transfer rather than a destination charge. The actual Transfer
 * call is shared with the Phase 2 buyer-confirmation and auto-timeout release
 * paths — see domains/payments/release.ts. Admin auditing (admin_actions)
 * happens here, not in the shared core, since only an admin actor has an
 * admin_id to attribute it to; this also covers a dispute an admin resolves by
 * releasing rather than refunding.
 *
 * Privileged and audited — never triggerable from a client (SECURITY.md).
 */
export async function releasePayment(
  adminId: string,
  transactionId: string,
  note?: string,
): Promise<AdminResult> {
  if (!stripeConfigured()) return { ok: false, error: PAYMENTS_UNCONFIGURED };

  const result = await releaseCore(transactionId, { type: "admin", adminId }, note);
  if (!result.ok) return result;

  await recordAction({
    adminId,
    actionType: "payment_released",
    targetType: "transaction",
    targetId: transactionId,
    notes: note ?? null,
  });

  return result;
}

export async function refundPayment(
  adminId: string,
  transactionId: string,
  note: string,
): Promise<AdminResult> {
  if (!stripeConfigured()) return { ok: false, error: PAYMENTS_UNCONFIGURED };

  const admin = createAdminClient();
  const { data: tx, error } = await admin
    .from("transactions")
    .select("id, escrow_status, stripe_payment_intent_id, listing_id, buyer_id")
    .eq("id", transactionId)
    .maybeSingle();

  if (error) throw error;
  if (!tx) return { ok: false, error: "Transaction not found." };
  // A dispute resolves through the same refund path as a held payment — it's
  // still an admin-only action either way.
  if (tx.escrow_status !== "held" && tx.escrow_status !== "disputed") {
    return { ok: false, error: `That payment is ${tx.escrow_status}, not held.` };
  }

  const stripe = getStripe();
  const refund = await stripe.refunds.create(
    { payment_intent: tx.stripe_payment_intent_id!, metadata: { transaction_id: tx.id } },
    { idempotencyKey: `refund_${tx.id}` },
  );

  await admin
    .from("transactions")
    .update({
      escrow_status: "refunded",
      refunded_at: new Date().toISOString(),
      released_by: adminId,
      stripe_refund_id: refund.id,
      admin_note: note,
      verification_status: "refunded_by_admin",
    })
    .eq("id", tx.id);

  // Put the ticket back on the market.
  await admin
    .from("listings")
    .update({ status: "active", reserved_by: null, reserved_at: null })
    .eq("id", tx.listing_id)
    .eq("status", "reserved");

  await admin.from("notifications").insert({
    user_id: tx.buyer_id,
    type: "payment_refunded",
    title: "Your purchase was refunded",
    body: note,
    listing_ref_id: tx.listing_id,
  });

  await recordAction({
    adminId,
    actionType: "payment_refunded",
    targetType: "transaction",
    targetId: tx.id,
    notes: note,
  });

  await logEvent({
    type: "purchase_refunded",
    userId: tx.buyer_id,
    listingRefId: tx.listing_id,
    metadata: { reason: note },
  });

  return { ok: true, message: "Refunded to the buyer." };
}

export async function recentAdminActions(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
