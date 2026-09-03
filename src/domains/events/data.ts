import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventDetailRow, EventRow, LineupEntry } from "@/lib/types";

const EVENT_COLUMNS =
  "id, name, venue, city, starts_at, doors_close_at, source_platform, original_price, verification_tier, flyer_url, tags, is_sold_out, status, price_source, source_url, submitted_by, approved_by, approved_at, review_note";

/**
 * Richer than EVENT_COLUMNS on purpose — this is only used by the single-event
 * detail fetch below, never by a browse/grid list, so the organizer join and
 * description/lineup payload never load for a tile that only shows a title.
 */
const EVENT_DETAIL_COLUMNS = `${EVENT_COLUMNS}, description, lineup, organizer:organizers(id, name, handle, avatar_url, bio)`;

export type EventFilters = {
  /** Genre/vibe tag, matched against events.tags. */
  tag?: string;
  /** Inclusive ceiling on face value. */
  maxPrice?: number;
  /** Single calendar day, YYYY-MM-DD in Montreal time. */
  date?: string;
  city?: string;
  /** Relative window from now — "tonight" (24h) or "week" (7d). Home's quick filters. */
  range?: "tonight" | "week";
};

/**
 * Browsable events. `discoverable` and `resale_enabled` both appear in the feed;
 * only `resale_enabled` can be listed against (enforced in the listings
 * service and by a database trigger).
 */
export async function listUpcomingEvents(
  filters: EventFilters = {},
  limit = 60,
): Promise<EventRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .in("status", ["discoverable", "resale_enabled"])
    .gte("starts_at", new Date().toISOString());

  query = applyFilters(query, filters);

  const { data, error } = await query.order("starts_at", { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

/** Events a seller may actually list against. */
export async function listResaleEnabledEvents(limit = 100): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("status", "resale_enabled")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

/**
 * Fetches events by id regardless of status or date — used for surfaces like
 * "liked events" where a saved event shouldn't silently disappear just
 * because it sold out or its date passed (unlike listUpcomingEvents, which
 * deliberately excludes both).
 */
export async function getEventsByIds(ids: string[]): Promise<EventRow[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).in("id", ids);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export async function getEventById(id: string): Promise<EventRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as EventRow | null) ?? null;
}

/** For the event detail page — includes organizer, description, lineup. */
export async function getEventDetailById(id: string): Promise<EventDetailRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as EventDetailRow;
  return {
    ...row,
    lineup: normalizeLineup(row.lineup),
  };
}

function normalizeLineup(value: unknown): LineupEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      name: typeof v.name === "string" ? v.name : "",
      role: typeof v.role === "string" ? v.role : undefined,
    }))
    .filter((v) => v.name.length > 0);
}

export async function searchEvents(query: string, filters: EventFilters = {}): Promise<EventRow[]> {
  const supabase = await createClient();
  const pattern = `%${query.replace(/[%_,()]/g, "")}%`;
  let q = supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .in("status", ["discoverable", "resale_enabled"])
    .or(`name.ilike.${pattern},venue.ilike.${pattern}`)
    .gte("starts_at", new Date().toISOString());

  q = applyFilters(q, filters);

  const { data, error } = await q.order("starts_at", { ascending: true }).limit(30);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

/** Every distinct tag on a browsable upcoming event — drives the filter chips. */
export async function listAvailableTags(): Promise<string[]> {
  const events = await listUpcomingEvents({}, 200);
  const tags = new Set<string>();
  for (const event of events) for (const tag of event.tags) tags.add(tag);
  return [...tags].sort((a, b) => a.localeCompare(b));
}

export async function listSubmissionsByUser(userId: string): Promise<EventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

/**
 * Reads event_authorizations, which no client role can see (RLS on, no
 * policies). Service-role only, and only ever consulted to compute a price cap.
 */
export async function getAuthorizedMaxResalePrice(eventId: string): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_authorizations")
    .select("max_resale_price")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.max_resale_price) : null;
}

/**
 * Structural shape of the chainable filter methods we use, so the same helper
 * works on any PostgREST query builder without fighting its generics.
 */
type Filterable<T> = {
  contains(column: string, value: string[]): T;
  eq(column: string, value: string): T;
  lte(column: string, value: number): T;
  gte(column: string, value: string): T;
  lt(column: string, value: string): T;
};

function applyFilters<T extends Filterable<T>>(query: T, filters: EventFilters): T {
  let q = query;
  if (filters.tag) q = q.contains("tags", [filters.tag]);
  if (typeof filters.maxPrice === "number" && Number.isFinite(filters.maxPrice)) {
    q = q.lte("original_price", filters.maxPrice);
  }
  if (filters.city) q = q.eq("city", filters.city);
  if (filters.date) {
    // A calendar day in Montreal, expressed as a UTC half-open range.
    const start = new Date(`${filters.date}T00:00:00-04:00`);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start.getTime() + 24 * 3_600_000);
      q = q.gte("starts_at", start.toISOString());
      q = q.lt("starts_at", end.toISOString());
    }
  }
  if (filters.range) {
    // Relative to "now" (like the base query's own gte(starts_at, now)),
    // not a computed local-midnight boundary — keeps this correct regardless
    // of what timezone the server process itself runs in.
    const hours = filters.range === "tonight" ? 24 : 24 * 7;
    q = q.lt("starts_at", new Date(Date.now() + hours * 3_600_000).toISOString());
  }
  return q;
}
