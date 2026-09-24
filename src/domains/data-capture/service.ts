import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  type EventDemandRow,
  type EventSalesSummary,
  type IntegrityFinding,
  type IntegrityRun,
  type LifecycleEntry,
  type Severity,
  type TicketLedgerRow,
  SEVERITIES,
} from "@/domains/data-capture/shared";

/**
 * Read side of the data-capture layer (DATA_CAPTURE.md).
 *
 * Everything here goes through the service-role client: the lifecycle log, the
 * integrity views and the analytics views carry no anon/authenticated grants at
 * all (see migration 20260923090400 § Access), so this module is the only way
 * into them, and it is only ever called from the ops console — which has its
 * own password gate — or from a CRON_SECRET-guarded route.
 */

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asSeverity(value: unknown): Severity {
  return SEVERITIES.includes(value as Severity) ? (value as Severity) : "info";
}

// ---------------------------------------------------------------------------
// Integrity
// ---------------------------------------------------------------------------

export async function listIntegrityFindings(): Promise<IntegrityFinding[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrity_findings")
    .select("check_name, severity, subject_type, subject_id, subject_label, event_slug, detail");
  if (error) throw new Error(`integrity_findings read failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    checkName: String(row.check_name),
    severity: asSeverity(row.severity),
    subjectType: (row.subject_type as string | null) ?? null,
    subjectId: (row.subject_id as string | null) ?? null,
    subjectLabel: (row.subject_label as string | null) ?? null,
    eventSlug: (row.event_slug as string | null) ?? null,
    detail: (row.detail as Record<string, unknown>) ?? {},
  }));
}

export type IntegrityRunResult = {
  ok: boolean;
  runId?: string;
  findings?: number;
  critical?: number;
  warning?: number;
  info?: number;
  error?: string;
};

/** Snapshot the current findings into integrity_findings_log. */
export async function runIntegrityChecks(
  source: "manual" | "cron" | "ops_console" | "script" = "manual",
): Promise<IntegrityRunResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_integrity_checks", { p_source: source });
  if (error) return { ok: false, error: error.message };

  const result = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    runId: result.run_id as string | undefined,
    findings: num(result.findings),
    critical: num(result.critical),
    warning: num(result.warning),
    info: num(result.info),
  };
}

export async function listIntegrityRuns(limit = 20): Promise<IntegrityRun[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrity_check_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`integrity_check_runs read failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    startedAt: String(row.started_at),
    finishedAt: (row.finished_at as string | null) ?? null,
    source: String(row.source),
    findingCount: num(row.finding_count),
    criticalCount: num(row.critical_count),
    warningCount: num(row.warning_count),
    infoCount: num(row.info_count),
  }));
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

function mapLifecycle(row: Record<string, unknown>): LifecycleEntry {
  return {
    id: Number(row.id),
    occurredAt: String(row.occurred_at),
    eventName: String(row.event_name),
    category: (row.event_category as string | null) ?? null,
    description: (row.event_description as string | null) ?? null,
    subjectType: String(row.subject_type),
    subjectId: (row.subject_id as string | null) ?? null,
    eventSlug: (row.event_slug as string | null) ?? null,
    unitId: (row.unit_id as string | null) ?? null,
    offerId: (row.offer_id as string | null) ?? null,
    sellLeadId: (row.sell_lead_id as string | null) ?? null,
    buyLeadId: (row.buy_lead_id as string | null) ?? null,
    contactId: (row.contact_id as string | null) ?? null,
    previousState: (row.previous_state as string | null) ?? null,
    newState: (row.new_state as string | null) ?? null,
    amount: numOrNull(row.amount),
    actorKind: String(row.actor_kind),
    actorLabel: (row.actor_label as string | null) ?? null,
    source: String(row.source),
    changedFields: (row.changed_fields as string[] | null) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

/** Everything that happened, newest first. */
export async function listRecentLifecycleEvents(limit = 100): Promise<LifecycleEntry[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("v_lifecycle_timeline")
    .select("*")
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`lifecycle read failed: ${error.message}`);
  return (data ?? []).map(mapLifecycle);
}

/**
 * Everything that happened to one ticket, offer, lead or contact — including
 * the rows that reference it indirectly, which is what makes "what happened to
 * this ticket" a single call rather than four.
 */
export async function getSubjectTimeline(
  subject: { unitId?: string; offerId?: string; sellLeadId?: string; buyLeadId?: string; contactId?: string },
  limit = 200,
): Promise<LifecycleEntry[]> {
  const admin = createAdminClient();
  const filters: string[] = [];
  if (subject.unitId) filters.push(`unit_id.eq.${subject.unitId}`);
  if (subject.offerId) filters.push(`offer_id.eq.${subject.offerId}`);
  if (subject.sellLeadId) filters.push(`sell_lead_id.eq.${subject.sellLeadId}`);
  if (subject.buyLeadId) filters.push(`buy_lead_id.eq.${subject.buyLeadId}`);
  if (subject.contactId) filters.push(`contact_id.eq.${subject.contactId}`);
  if (filters.length === 0) return [];

  const { data, error } = await admin
    .from("v_lifecycle_timeline")
    .select("*")
    .or(filters.join(","))
    .order("occurred_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`lifecycle read failed: ${error.message}`);
  return (data ?? []).map(mapLifecycle);
}

/**
 * Record something that happened off-app — a hand-off at the door, a refund
 * sent by DM — against a subject, so the manual half of the beta is in the
 * same history as the in-app half.
 */
export async function recordManualEvent(input: {
  subjectType: string;
  subjectId: string;
  note: string;
  actorLabel?: string;
  eventSlug?: string | null;
  amount?: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_manual_event", {
    p_subject_type: input.subjectType,
    p_subject_id: input.subjectId,
    p_note: input.note,
    p_actor_label: input.actorLabel ?? "ops",
    p_event_slug: input.eventSlug ?? null,
    p_amount: input.amount ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const result = (data ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) return { ok: false, error: result.error ?? "Could not record the note." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function listTicketLedger(eventSlug?: string, limit = 200): Promise<TicketLedgerRow[]> {
  const admin = createAdminClient();
  let query = admin.from("v_ticket_ledger").select("*").order("listed_at", { ascending: false });
  if (eventSlug) query = query.eq("event_slug", eventSlug);

  const { data, error } = await query.limit(limit);
  if (error) throw new Error(`ticket ledger read failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    unitId: String(row.unit_id),
    eventSlug: String(row.event_slug),
    eventName: String(row.event_name),
    unitIndex: num(row.unit_index),
    unitStatus: String(row.unit_status),
    stage: String(row.stage),
    priceEach: num(row.price_each),
    faceValue: numOrNull(row.face_value),
    listedAt: String(row.listed_at),
    sellLeadId: String(row.sell_lead_id),
    sellerContactId: (row.seller_contact_id as string | null) ?? null,
    buyerSeatKind: (row.buyer_seat_kind as "go" | "classic" | null) ?? null,
    buyerContactId: (row.buyer_contact_id as string | null) ?? null,
    buyerMemberId: (row.buyer_member_id as string | null) ?? null,
    buyerKey: (row.buyer_key as string | null) ?? null,
    winningOfferId: (row.winning_offer_id as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    saleAmountCad: numOrNull(row.sale_amount_cad),
    forwardedToBuyerAt: (row.forwarded_to_buyer_at as string | null) ?? null,
    payoutReleasedAt: (row.payout_released_at as string | null) ?? null,
    payoutConfirmedAt: (row.payout_confirmed_at as string | null) ?? null,
    minutesListedToPaid: numOrNull(row.minutes_listed_to_paid),
  }));
}

export async function listEventSalesSummary(): Promise<EventSalesSummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("v_event_sales_summary")
    .select("*")
    .order("gross_sales_cad", { ascending: false });
  if (error) throw new Error(`sales summary read failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    eventSlug: String(row.event_slug),
    eventName: String(row.event_name),
    unitsListed: num(row.units_listed),
    unitsAvailable: num(row.units_available),
    unitsSold: num(row.units_sold),
    unitsWithdrawn: num(row.units_withdrawn),
    unitsOnHold: num(row.units_on_hold),
    grossSalesCad: num(row.gross_sales_cad),
    avgSalePriceCad: numOrNull(row.avg_sale_price_cad),
    distinctBuyers: num(row.distinct_buyers),
    distinctSellers: num(row.distinct_sellers),
    sellThroughPct: numOrNull(row.sell_through_pct),
    medianMinutesToSell: numOrNull(row.median_minutes_to_sell),
    awaitingDelivery: num(row.awaiting_delivery),
    awaitingPayout: num(row.awaiting_payout),
    firstSaleAt: (row.first_sale_at as string | null) ?? null,
    lastSaleAt: (row.last_sale_at as string | null) ?? null,
  }));
}

export async function listEventDemand(): Promise<EventDemandRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("v_event_demand")
    .select("*")
    .order("tickets_wanted", { ascending: false });
  if (error) throw new Error(`demand read failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    eventSlug: String(row.event_slug),
    eventName: String(row.event_name),
    buySeats: num(row.buy_seats),
    classicSeats: num(row.classic_seats),
    ticketsWanted: num(row.tickets_wanted),
    seatsFulfilled: num(row.seats_fulfilled),
    dormantSeats: num(row.dormant_seats),
    unitsListed: num(row.units_listed),
    unitsAvailable: num(row.units_available),
    unitsSold: num(row.units_sold),
    unmetDemand: num(row.unmet_demand),
    demandFilledPct: numOrNull(row.demand_filled_pct),
  }));
}

/** Raw passthrough for the views the ops console shows as-is. */
export async function readAnalyticsView(
  view:
    | "v_event_sales_daily"
    | "v_offer_funnel"
    | "v_seller_performance"
    | "v_buyer_behaviour"
    | "v_sales_velocity"
    | "v_platform_daily",
  options: { limit?: number; orderBy?: string; ascending?: boolean } = {},
): Promise<Record<string, unknown>[]> {
  const admin = createAdminClient();
  let query = admin.from(view).select("*");
  if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? false });
  const { data, error } = await query.limit(options.limit ?? 100);
  if (error) throw new Error(`${view} read failed: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}
