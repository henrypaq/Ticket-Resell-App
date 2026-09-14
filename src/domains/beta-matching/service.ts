import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { listUnifiedQueueSeats } from "@/domains/beta-queue/unified";
import { logEvent } from "@/lib/analytics/log";
import { doorsAtForEvent } from "@/domains/matching/doors";
import { notifyOfferSeat } from "@/domains/beta-matching/notify";
import {
  type DeclineReason,
  type OfferStatus,
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
} from "@/domains/beta-matching/policy";

export type MatchingResult =
  | { ok: true; id?: string; ids?: string[]; mode?: string; skipped?: string }
  | { ok: false; error: string };

type UnitRow = {
  id: string;
  sell_lead_id: string;
  event_slug: string;
  unit_index: number;
  price_each: number;
  status: "available" | "sold" | "withdrawn";
};

type OfferRow = {
  id: string;
  group_id: string;
  unit_id: string;
  buy_lead_id: string | null;
  classic_interest_id: string | null;
  seat_key: string;
  event_slug: string;
  rank: number;
  price_each: number;
  status: OfferStatus;
  offered_at: string;
  expires_at: string;
  payment_due_at: string | null;
  decline_reason: DeclineReason | null;
};

function parseSeat(seatKey: string): {
  buyLeadId: string | null;
  classicInterestId: string | null;
} {
  if (seatKey.startsWith("go:")) {
    return { buyLeadId: seatKey.slice(3), classicInterestId: null };
  }
  if (seatKey.startsWith("classic:")) {
    return { buyLeadId: null, classicInterestId: seatKey.slice(8) };
  }
  return { buyLeadId: null, classicInterestId: null };
}

/**
 * Materialize one unit per ticket on a sell lead. Idempotent: re-running for
 * the same lead fills missing indexes only (unique on sell_lead_id, unit_index).
 */
export async function createUnitsFromSellLead(sellLeadId: string): Promise<MatchingResult> {
  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("beta_go_leads")
    .select("id, intent, event_slug, quantity, ask_each, paid_each, status")
    .eq("id", sellLeadId)
    .maybeSingle();

  if (error || !lead) return { ok: false, error: "Sell lead not found." };
  if (lead.intent !== "sell") return { ok: false, error: "Not a sell lead." };
  if (lead.status === "cancelled") return { ok: false, error: "Sell lead is cancelled." };

  const qty = Math.max(1, Number(lead.quantity) || 1);
  const ask = Number(lead.ask_each);
  const paid = lead.paid_each == null ? null : Number(lead.paid_each);
  if (!Number.isFinite(ask) || ask < 0) {
    return { ok: false, error: "Sell lead is missing a valid ask price." };
  }
  // Never exceed attested face value — same rule as the unit trigger.
  const price = paid != null && Number.isFinite(paid) ? Math.min(ask, paid) : ask;

  const { data: existing } = await admin
    .from("beta_ticket_units")
    .select("unit_index")
    .eq("sell_lead_id", sellLeadId);

  const have = new Set((existing ?? []).map((r) => Number(r.unit_index)));
  const rows = [];
  for (let i = 1; i <= qty; i++) {
    if (have.has(i)) continue;
    rows.push({
      sell_lead_id: sellLeadId,
      event_slug: lead.event_slug,
      unit_index: i,
      price_each: price,
      status: "available" as const,
    });
  }

  if (rows.length === 0) return { ok: true, ids: [] };

  const { data: inserted, error: insertError } = await admin
    .from("beta_ticket_units")
    .insert(rows)
    .select("id");

  if (insertError) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "create_units_failed",
        sellLeadId,
        error: insertError.message,
      }),
    );
    return { ok: false, error: insertError.message };
  }

  return { ok: true, ids: (inserted ?? []).map((r) => r.id as string) };
}

async function loadSeatMeta(
  admin: ReturnType<typeof createAdminClient>,
  seatKey: string,
  eventSlug: string,
): Promise<{
  quantity: number;
  maxPriceEach: number | null;
  contactId: string | null;
  memberId: string | null;
  dormant: boolean;
  declinedAtOrAbove: number[];
  liveOfferCount: number;
  noResponseStrikes: number;
  unpaidStrikes: number;
} | null> {
  const { buyLeadId, classicInterestId } = parseSeat(seatKey);
  let quantity = 1;
  let maxPriceEach: number | null = null;
  let contactId: string | null = null;
  let memberId: string | null = null;

  if (buyLeadId) {
    const { data } = await admin
      .from("beta_go_leads")
      .select("id, quantity, max_price_each, contact_id, member_id, event_slug, status, intent")
      .eq("id", buyLeadId)
      .maybeSingle();
    if (!data || data.intent !== "buy" || data.event_slug !== eventSlug) return null;
    if (data.status === "cancelled") return null;
    quantity = Math.max(1, Number(data.quantity) || 1);
    maxPriceEach = data.max_price_each == null ? null : Number(data.max_price_each);
    contactId = data.contact_id;
    memberId = data.member_id;
  } else if (classicInterestId) {
    const { data } = await admin
      .from("beta_member_interests")
      .select("id, member_id, event_slug, intent")
      .eq("id", classicInterestId)
      .maybeSingle();
    if (!data || data.intent !== "waitlist" || data.event_slug !== eventSlug) return null;
    memberId = data.member_id;
  } else {
    return null;
  }

  const [{ data: state }, { data: live }, { data: history }] = await Promise.all([
    admin.from("beta_queue_seat_state").select("dormant_at, reactivated_at").eq("seat_key", seatKey).maybeSingle(),
    admin
      .from("beta_offers")
      .select("id")
      .eq("seat_key", seatKey)
      .in("status", ["offered", "accepted", "paid", "needs_review"]),
    admin
      .from("beta_offers")
      .select("status, price_each, decline_reason, offered_at")
      .eq("seat_key", seatKey)
      .in("status", ["declined", "expired_no_response", "expired_unpaid"]),
  ]);

  const reactivatedAt = state?.reactivated_at ? new Date(state.reactivated_at).getTime() : 0;
  const recent = (history ?? []).filter(
    (h) => new Date(h.offered_at).getTime() >= reactivatedAt,
  );
  const declinedAtOrAbove = recent
    .filter((h) => h.status === "declined" && h.decline_reason === "price")
    .map((h) => Number(h.price_each));
  const noResponseStrikes = recent.filter((h) => h.status === "expired_no_response").length;
  const unpaidStrikes = recent.filter((h) => h.status === "expired_unpaid").length;

  return {
    quantity,
    maxPriceEach,
    contactId,
    memberId,
    dormant: Boolean(state?.dormant_at),
    declinedAtOrAbove,
    liveOfferCount: live?.length ?? 0,
    noResponseStrikes,
    unpaidStrikes,
  };
}

async function unitSellerIds(
  admin: ReturnType<typeof createAdminClient>,
  unit: UnitRow,
): Promise<{ contactId: string | null; memberId: string | null }> {
  const { data } = await admin
    .from("beta_go_leads")
    .select("contact_id, member_id")
    .eq("id", unit.sell_lead_id)
    .maybeSingle();
  return { contactId: data?.contact_id ?? null, memberId: data?.member_id ?? null };
}

async function exclusivitySpendForUnit(
  admin: ReturnType<typeof createAdminClient>,
  unitId: string,
  now: Date,
): Promise<{ spentMs: number; ranksUsed: number }> {
  const { data } = await admin
    .from("beta_offers")
    .select("status, offered_at, expires_at, payment_due_at, rank")
    .eq("unit_id", unitId)
    .order("offered_at", { ascending: true });

  let spentMs = 0;
  const ranks = new Set<number>();
  for (const row of data ?? []) {
    ranks.add(Number(row.rank));
    spentMs += offerOffMarketMs(
      {
        status: row.status as OfferStatus,
        offeredAt: new Date(row.offered_at),
        expiresAt: new Date(row.expires_at),
        paymentDueAt: row.payment_due_at ? new Date(row.payment_due_at) : null,
      },
      now,
    );
  }
  return { spentMs, ranksUsed: ranks.size };
}

/**
 * Offer the next eligible real seat(s) for one available unit.
 * Uses `allocate_offer` RPC so expire-then-insert is one transaction.
 */
export async function allocateNextForUnit(args: {
  unitId: string;
  now?: Date;
  doorsAt?: Date | null;
}): Promise<MatchingResult> {
  const now = args.now ?? new Date();
  const admin = createAdminClient();

  const { data: unit, error } = await admin
    .from("beta_ticket_units")
    .select("id, sell_lead_id, event_slug, unit_index, price_each, status")
    .eq("id", args.unitId)
    .maybeSingle();

  if (error || !unit) return { ok: false, error: "Unit not found." };
  if (unit.status !== "available") {
    return { ok: false, error: `Unit is ${unit.status}.` };
  }

  const doorsAt = args.doorsAt !== undefined ? args.doorsAt : doorsAtForEvent(unit.event_slug, now);
  const mode = matchingModeAt(now, doorsAt);
  if (mode === "open") {
    return {
      ok: true,
      skipped: "open_mode",
      mode,
    };
  }

  const spend = await exclusivitySpendForUnit(admin, unit.id, now);
  if (exclusivityBudgetExhausted(spend)) {
    return { ok: true, skipped: "budget_exhausted", mode: "open" };
  }

  const seats = await listUnifiedQueueSeats(unit.event_slug);
  const seller = await unitSellerIds(admin, unit as UnitRow);
  const expiresAt = responseDeadline({ now, mode });
  const groupId = crypto.randomUUID();

  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i]!;
    const meta = await loadSeatMeta(admin, seat.key, unit.event_slug);
    if (!meta) continue;

    const isSeller =
      (seller.contactId != null && seller.contactId === meta.contactId) ||
      (seller.memberId != null && seller.memberId === meta.memberId);

    const eligibility = seatEligibleForOffer({
      seatKey: seat.key,
      quantity: meta.quantity,
      maxPriceEach: meta.maxPriceEach,
      unitPriceEach: Number(unit.price_each),
      liveOfferCount: meta.liveOfferCount,
      dormant: meta.dormant,
      isSeller,
      declinedAtOrAbove: meta.declinedAtOrAbove,
    });
    if (!eligibility.ok) continue;

    const count = partialOfferCount({
      seatQuantity: meta.quantity,
      liveOfferCount: meta.liveOfferCount,
      freeUnits: 1,
    });
    if (count < 1) continue;

    const { buyLeadId, classicInterestId } = parseSeat(seat.key);
    const rank = rankOfSeat(seats, seat.key) ?? i + 1;

    const { data: offerId, error: rpcError } = await admin.rpc("allocate_offer", {
      p_unit_id: unit.id,
      p_buy_lead_id: buyLeadId,
      p_classic_interest_id: classicInterestId,
      p_event_slug: unit.event_slug,
      p_rank: rank,
      p_price_each: Number(unit.price_each),
      p_expires_at: expiresAt.toISOString(),
      p_group_id: groupId,
      p_now: now.toISOString(),
    });

    if (rpcError) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "allocate_offer_rpc_failed",
          unitId: unit.id,
          error: rpcError.message,
        }),
      );
      return { ok: false, error: rpcError.message };
    }

    if (!offerId) continue;

    void logEvent({
      type: "waitlist_offer_sent",
      metadata: {
        offer_id: offerId,
        unit_id: unit.id,
        seat_key: seat.key,
        rank,
        mode,
        price_each: Number(unit.price_each),
        event_slug: unit.event_slug,
      },
    });

    void notifyOfferSeat({
      kind: "offered",
      seatKey: seat.key,
      priceEach: Number(unit.price_each),
      offerId: offerId as string,
      eventSlug: unit.event_slug,
      deadlineIso: expiresAt.toISOString(),
    });

    // Warm the next eligible seat (notification only — no offer row).
    void warmNextSeat({
      eventSlug: unit.event_slug,
      afterSeatKey: seat.key,
      priceEach: Number(unit.price_each),
      seller,
    });

    // Mirror lead status for ops familiarity — offer row is the source of truth.
    if (buyLeadId) {
      await admin
        .from("beta_go_leads")
        .update({ status: "matched", updated_at: now.toISOString() })
        .eq("id", buyLeadId)
        .neq("status", "done")
        .neq("status", "cancelled");
    }

    return { ok: true, id: offerId as string, mode };
  }

  return { ok: true, skipped: "no_eligible_seat", mode };
}

async function warmNextSeat(args: {
  eventSlug: string;
  afterSeatKey: string;
  priceEach: number;
  seller: { contactId: string | null; memberId: string | null };
}): Promise<void> {
  const seats = await listUnifiedQueueSeats(args.eventSlug);
  const admin = createAdminClient();
  let passed = false;
  for (const seat of seats) {
    if (!passed) {
      if (seat.key === args.afterSeatKey) passed = true;
      continue;
    }
    const meta = await loadSeatMeta(admin, seat.key, args.eventSlug);
    if (!meta) continue;
    const isSeller =
      (args.seller.contactId != null && args.seller.contactId === meta.contactId) ||
      (args.seller.memberId != null && args.seller.memberId === meta.memberId);
    const eligibility = seatEligibleForOffer({
      seatKey: seat.key,
      quantity: meta.quantity,
      maxPriceEach: meta.maxPriceEach,
      unitPriceEach: args.priceEach,
      liveOfferCount: meta.liveOfferCount,
      dormant: meta.dormant,
      isSeller,
      declinedAtOrAbove: meta.declinedAtOrAbove,
    });
    if (!eligibility.ok) continue;
    await notifyOfferSeat({
      kind: "next_up",
      seatKey: seat.key,
      priceEach: args.priceEach,
      eventSlug: args.eventSlug,
    });
    return;
  }
}

async function applyDormancyIfNeeded(args: {
  seatKey: string;
  eventSlug: string;
  event: "expired_no_response" | "expired_unpaid";
  noResponseStrikes: number;
  unpaidStrikes: number;
}): Promise<void> {
  if (
    !shouldGoDormant({
      event: args.event,
      noResponseStrikes: args.noResponseStrikes,
      unpaidStrikes: args.unpaidStrikes,
    })
  ) {
    return;
  }
  const admin = createAdminClient();
  await admin.from("beta_queue_seat_state").upsert(
    {
      seat_key: args.seatKey,
      event_slug: args.eventSlug,
      dormant_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "seat_key" },
  );
}

export async function acceptOffer(offerId: string, doorsAt?: Date | null): Promise<MatchingResult> {
  const now = new Date();
  const admin = createAdminClient();

  const { data: offer, error } = await admin
    .from("beta_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();
  if (error || !offer) return { ok: false, error: "Offer not found." };

  const resolvedDoors =
    doorsAt !== undefined ? doorsAt : doorsAtForEvent(offer.event_slug, now);
  const mode = matchingModeAt(now, resolvedDoors);

  const lazy = lazyExpiryStatus(
    {
      status: offer.status,
      offeredAt: new Date(offer.offered_at),
      expiresAt: new Date(offer.expires_at),
      paymentDueAt: offer.payment_due_at ? new Date(offer.payment_due_at) : null,
    },
    now,
  );
  if (lazy) {
    await admin
      .from("beta_offers")
      .update({ status: lazy, responded_at: now.toISOString() })
      .eq("id", offerId);
    return { ok: false, error: "Offer already expired." };
  }

  if (offer.status !== "offered") {
    return { ok: false, error: `Offer is ${offer.status}.` };
  }

  // Near doors: accepting must not park the unit on an unpaid promise.
  if (mode === "open") {
    return {
      ok: false,
      error: "Too close to doors — claim only when payment is confirmed (mark paid).",
    };
  }

  const due = paymentDeadline({ now, mode });
  const { error: updateError } = await admin
    .from("beta_offers")
    .update({
      status: "accepted",
      responded_at: now.toISOString(),
      payment_due_at: due?.toISOString() ?? null,
    })
    .eq("id", offerId)
    .eq("status", "offered");

  if (updateError) return { ok: false, error: updateError.message };

  void logEvent({
    type: "waitlist_offer_accepted",
    metadata: { offer_id: offerId, unit_id: offer.unit_id, seat_key: offer.seat_key },
  });

  return { ok: true, id: offerId };
}

export async function declineOffer(
  offerId: string,
  reason: DeclineReason,
): Promise<MatchingResult> {
  const now = new Date();
  const admin = createAdminClient();

  const { data: offer, error } = await admin
    .from("beta_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();
  if (error || !offer) return { ok: false, error: "Offer not found." };
  if (offer.status !== "offered" && offer.status !== "accepted") {
    return { ok: false, error: `Offer is ${offer.status}.` };
  }

  const { error: updateError } = await admin
    .from("beta_offers")
    .update({
      status: "declined",
      decline_reason: reason,
      responded_at: now.toISOString(),
    })
    .eq("id", offerId)
    .in("status", ["offered", "accepted"]);

  if (updateError) return { ok: false, error: updateError.message };

  if (reason === "price" && offer.buy_lead_id) {
    // Capture ceiling so the allocator skips this price next time.
    await admin
      .from("beta_go_leads")
      .update({
        max_price_each: Number(offer.price_each) - 0.01 > 0 ? Number(offer.price_each) - 0.01 : 0,
        updated_at: now.toISOString(),
      })
      .eq("id", offer.buy_lead_id)
      .is("max_price_each", null);
  }

  if (reason === "not_going" && offer.buy_lead_id) {
    await admin
      .from("beta_go_leads")
      .update({ status: "cancelled", updated_at: now.toISOString() })
      .eq("id", offer.buy_lead_id);
  }

  void logEvent({
    type: "waitlist_offer_declined",
    metadata: {
      offer_id: offerId,
      unit_id: offer.unit_id,
      seat_key: offer.seat_key,
      reason,
    },
  });

  // Requeue immediately for the next eligible seat.
  const next = await allocateNextForUnit({ unitId: offer.unit_id });
  return next.ok ? { ok: true, id: offerId, ids: next.id ? [next.id] : [] } : next;
}

export async function markOfferPaid(
  offerId: string,
  payment?: { amount?: number; reference?: string; recordedBy?: string },
): Promise<MatchingResult> {
  const now = new Date();
  const admin = createAdminClient();

  const { data: offer, error } = await admin
    .from("beta_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();
  if (error || !offer) return { ok: false, error: "Offer not found." };

  if (!["offered", "accepted", "needs_review"].includes(offer.status)) {
    return { ok: false, error: `Offer is ${offer.status}.` };
  }

  const { error: updateError } = await admin
    .from("beta_offers")
    .update({
      status: "paid",
      responded_at: offer.responded_at ?? now.toISOString(),
      payment_amount: payment?.amount ?? Number(offer.price_each),
      payment_reference: payment?.reference ?? null,
      payment_recorded_at: now.toISOString(),
      payment_recorded_by: payment?.recordedBy ?? "ops",
    })
    .eq("id", offerId);

  if (updateError) return { ok: false, error: updateError.message };

  if (offer.buy_lead_id) {
    await admin
      .from("beta_go_leads")
      .update({ status: "done", updated_at: now.toISOString() })
      .eq("id", offer.buy_lead_id);
  }

  void logEvent({
    type: "waitlist_offer_paid",
    metadata: { offer_id: offerId, unit_id: offer.unit_id, seat_key: offer.seat_key },
  });

  void notifyOfferSeat({
    kind: "paid",
    seatKey: offer.seat_key,
    priceEach: Number(offer.price_each),
    offerId,
    eventSlug: offer.event_slug,
  });

  return { ok: true, id: offerId };
}

export async function markOfferNeedsReview(offerId: string): Promise<MatchingResult> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("beta_offers")
    .update({ status: "needs_review" })
    .eq("id", offerId)
    .in("status", ["accepted", "offered"]);
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: offerId };
}

export async function markOfferPaymentFailed(offerId: string): Promise<MatchingResult> {
  const now = new Date();
  const admin = createAdminClient();
  const { data: offer } = await admin.from("beta_offers").select("*").eq("id", offerId).maybeSingle();
  if (!offer) return { ok: false, error: "Offer not found." };

  const { error } = await admin
    .from("beta_offers")
    .update({ status: "payment_failed", responded_at: now.toISOString() })
    .eq("id", offerId)
    .in("status", ["accepted", "needs_review"]);
  if (error) return { ok: false, error: error.message };

  const spend = await exclusivitySpendForUnit(admin, offer.unit_id, now);
  const doorsAt = doorsAtForEvent(offer.event_slug, now);
  const mode = matchingModeAt(now, doorsAt);
  const action = nextAllocationAction({
    terminalStatus: "payment_failed",
    spendAfter: spend,
    mode,
  });
  if (action === "next_rank") {
    await allocateNextForUnit({ unitId: offer.unit_id, now, doorsAt });
  }
  return { ok: true, id: offerId, skipped: action === "open" ? "open_after_fail" : undefined };
}

/**
 * Cron entry: materialize expiries, apply strikes, and advance units whose
 * exclusive holds just freed. Idempotent.
 */
export async function reconcileExpiredOffers(now = new Date()): Promise<{
  expired: number;
  advanced: string[];
  errors: { offerId?: string; error: string }[];
}> {
  const admin = createAdminClient();
  const summary = { expired: 0, advanced: [] as string[], errors: [] as { offerId?: string; error: string }[] };

  const { data: expiredRows, error } = await admin.rpc("reconcile_expired_offers", {
    p_now: now.toISOString(),
  });

  if (error) {
    summary.errors.push({ error: error.message });
    return summary;
  }

  const rows = (expiredRows ?? []) as {
    offer_id: string;
    unit_id: string;
    event_slug: string;
    seat_key: string;
    new_status: OfferStatus;
  }[];
  summary.expired = rows.length;

  const unitsToAdvance = new Set<string>();

  for (const row of rows) {
    void logEvent({
      type: "waitlist_offer_expired",
      metadata: {
        offer_id: row.offer_id,
        unit_id: row.unit_id,
        seat_key: row.seat_key,
        status: row.new_status,
      },
    });

    void notifyOfferSeat({
      kind: "expired",
      seatKey: row.seat_key,
      priceEach: 0,
      offerId: row.offer_id,
      eventSlug: row.event_slug,
    });

    if (row.new_status === "expired_no_response" || row.new_status === "expired_unpaid") {
      const meta = await loadSeatMeta(admin, row.seat_key, row.event_slug);
      if (meta) {
        // History query already includes this terminal row.
        await applyDormancyIfNeeded({
          seatKey: row.seat_key,
          eventSlug: row.event_slug,
          event: row.new_status,
          noResponseStrikes: meta.noResponseStrikes,
          unpaidStrikes: meta.unpaidStrikes,
        });
      }
    }

    const spend = await exclusivitySpendForUnit(admin, row.unit_id, now);
    const doorsAt = doorsAtForEvent(row.event_slug, now);
    const mode = matchingModeAt(now, doorsAt);
    const action = nextAllocationAction({
      terminalStatus: row.new_status,
      spendAfter: spend,
      mode,
    });
    if (action === "next_rank") unitsToAdvance.add(row.unit_id);
  }

  for (const unitId of unitsToAdvance) {
    const result = await allocateNextForUnit({ unitId, now });
    if (result.ok && result.id) summary.advanced.push(result.id);
    if (!result.ok) summary.errors.push({ error: result.error });
  }

  return summary;
}

export async function listOffersForEvent(eventSlug: string): Promise<OfferRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("beta_offers")
    .select(
      "id, group_id, unit_id, buy_lead_id, classic_interest_id, seat_key, event_slug, rank, price_each, status, offered_at, expires_at, payment_due_at, decline_reason",
    )
    .eq("event_slug", eventSlug)
    .order("offered_at", { ascending: false })
    .limit(200);
  return (data ?? []) as OfferRow[];
}

export async function listRecentOffers(limit = 100): Promise<OfferRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("beta_offers")
    .select(
      "id, group_id, unit_id, buy_lead_id, classic_interest_id, seat_key, event_slug, rank, price_each, status, offered_at, expires_at, payment_due_at, decline_reason",
    )
    .order("offered_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as OfferRow[];
}

export async function listAvailableUnits(eventSlug?: string): Promise<UnitRow[]> {
  const admin = createAdminClient();
  let q = admin
    .from("beta_ticket_units")
    .select("id, sell_lead_id, event_slug, unit_index, price_each, status")
    .eq("status", "available")
    .order("created_at", { ascending: true });
  if (eventSlug) q = q.eq("event_slug", eventSlug);
  const { data } = await q;
  return (data ?? []) as UnitRow[];
}

/** Mark a unit as open-market: expire any live exclusive hold without re-offering. */
export async function releaseUnitToOpen(unitId: string): Promise<MatchingResult> {
  const now = new Date();
  const admin = createAdminClient();
  const { data: live } = await admin
    .from("beta_offers")
    .select("id, status")
    .eq("unit_id", unitId)
    .in("status", ["offered", "accepted"]);

  for (const row of live ?? []) {
    const status = row.status === "accepted" ? "expired_unpaid" : "expired_no_response";
    await admin
      .from("beta_offers")
      .update({ status, responded_at: now.toISOString() })
      .eq("id", row.id);
  }

  return { ok: true, id: unitId, mode: "open", skipped: "released_to_open" };
}

/** Clear dormancy so the seat can receive exclusive holds again. */
export async function reactivateSeat(seatKey: string): Promise<MatchingResult> {
  const admin = createAdminClient();
  const eventSlug = seatKey.includes(":")
    ? (
        await (async () => {
          if (seatKey.startsWith("go:")) {
            const { data } = await admin
              .from("beta_go_leads")
              .select("event_slug")
              .eq("id", seatKey.slice(3))
              .maybeSingle();
            return data?.event_slug as string | undefined;
          }
          const { data } = await admin
            .from("beta_member_interests")
            .select("event_slug")
            .eq("id", seatKey.slice(8))
            .maybeSingle();
          return data?.event_slug as string | undefined;
        })()
      )
    : undefined;

  if (!eventSlug) return { ok: false, error: "Seat not found." };

  const now = new Date().toISOString();
  const { error } = await admin.from("beta_queue_seat_state").upsert(
    {
      seat_key: seatKey,
      event_slug: eventSlug,
      dormant_at: null,
      reactivated_at: now,
      updated_at: now,
    },
    { onConflict: "seat_key" },
  );
  if (error) return { ok: false, error: error.message };

  void notifyOfferSeat({
    kind: "reactivate",
    seatKey,
    priceEach: 0,
    eventSlug,
  });

  return { ok: true };
}

/** Create missing units for every open sell lead (idempotent backfill). */
export async function backfillAllSellUnits(): Promise<{ created: number; errors: string[] }> {
  const admin = createAdminClient();
  const { data: sells } = await admin
    .from("beta_go_leads")
    .select("id")
    .eq("intent", "sell")
    .neq("status", "cancelled");

  let created = 0;
  const errors: string[] = [];
  for (const row of sells ?? []) {
    const result = await createUnitsFromSellLead(row.id);
    if (!result.ok) errors.push(`${row.id}: ${result.error}`);
    else created += result.ids?.length ?? 0;
  }
  return { created, errors };
}

export async function getOfferForBuyer(
  offerId: string,
): Promise<(OfferRow & { event_slug: string }) | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("beta_offers").select("*").eq("id", offerId).maybeSingle();
  return (data as OfferRow | null) ?? null;
}
