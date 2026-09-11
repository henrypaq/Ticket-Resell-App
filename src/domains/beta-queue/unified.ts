import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { defaultFakeFront, getFakeFront, getFakeFrontMap } from "@/domains/beta-queue/padding";

/**
 * One shared waitlist queue per event across classic (`beta_member_interests`)
 * and `/go` (`beta_go_leads` buy). Positions and ticket demand must match
 * on `/`, `/go`, and `/ops`.
 */

export type UnifiedQueueSeat = {
  key: string;
  source: "classic" | "go";
  /** Classic interest id or /go lead id. */
  id: string;
  signupId: string | null;
  createdAt: string;
  /** Tickets requested — classic joins count as 1. */
  quantity: number;
};

export type UnifiedQueueStats = {
  /** Real joiner count (people / seats), excluding fake front. */
  realSeats: number;
  /** Sum of ticket quantities across classic + /go. */
  ticketDemand: number;
  fakeFront: number;
  /** What the next joiner would see as their # before joining. */
  nextDisplayedPosition: number;
};

/** Chronological seats for one event (oldest first). */
export async function listUnifiedQueueSeats(
  eventSlug: string,
): Promise<UnifiedQueueSeat[]> {
  const admin = createAdminClient();
  const [{ data: classic }, { data: go }] = await Promise.all([
    admin
      .from("beta_member_interests")
      .select("id, member_id, created_at")
      .eq("event_slug", eventSlug)
      .eq("intent", "waitlist"),
    admin
      .from("beta_go_leads")
      .select("id, quantity, created_at, status")
      .eq("event_slug", eventSlug)
      .eq("intent", "buy")
      .neq("status", "cancelled"),
  ]);

  const seats: UnifiedQueueSeat[] = [
    ...(classic ?? []).map((row) => ({
      key: `classic:${row.id}`,
      source: "classic" as const,
      id: row.id,
      signupId: row.member_id as string,
      createdAt: row.created_at as string,
      quantity: 1,
    })),
    ...(go ?? []).map((row) => ({
      key: `go:${row.id}`,
      source: "go" as const,
      id: row.id as string,
      signupId: null,
      createdAt: row.created_at as string,
      quantity: Number(row.quantity) || 1,
    })),
  ];

  seats.sort((a, b) => {
    const t = a.createdAt.localeCompare(b.createdAt);
    if (t !== 0) return t;
    return a.key.localeCompare(b.key);
  });
  return seats;
}

/** All seats across events, oldest first within each slug. */
export async function listAllUnifiedQueueSeats(): Promise<Map<string, UnifiedQueueSeat[]>> {
  const admin = createAdminClient();
  const [{ data: classic }, { data: go }] = await Promise.all([
    admin
      .from("beta_member_interests")
      .select("id, member_id, event_slug, created_at")
      .eq("intent", "waitlist"),
    admin
      .from("beta_go_leads")
      .select("id, event_slug, quantity, created_at, status")
      .eq("intent", "buy")
      .neq("status", "cancelled"),
  ]);

  const map = new Map<string, UnifiedQueueSeat[]>();
  const push = (slug: string, seat: UnifiedQueueSeat) => {
    const list = map.get(slug) ?? [];
    list.push(seat);
    map.set(slug, list);
  };

  for (const row of classic ?? []) {
    push(row.event_slug, {
      key: `classic:${row.id}`,
      source: "classic",
      id: row.id,
      signupId: row.member_id,
      createdAt: row.created_at,
      quantity: 1,
    });
  }
  for (const row of go ?? []) {
    push(row.event_slug, {
      key: `go:${row.id}`,
      source: "go",
      id: row.id,
      signupId: null,
      createdAt: row.created_at,
      quantity: Number(row.quantity) || 1,
    });
  }

  for (const [, seats] of map) {
    seats.sort((a, b) => {
      const t = a.createdAt.localeCompare(b.createdAt);
      if (t !== 0) return t;
      return a.key.localeCompare(b.key);
    });
  }
  return map;
}

function displayedFromIndex(index: number, fakeFront: number): number {
  return index + 1 + fakeFront;
}

/** Displayed # for a classic signup on an event (null if not on that waitlist). */
export async function getUnifiedPositionForSignup(
  signupId: string,
  eventSlug: string,
): Promise<number | null> {
  const [seats, fakeFront] = await Promise.all([
    listUnifiedQueueSeats(eventSlug),
    getFakeFront(eventSlug),
  ]);
  const index = seats.findIndex(
    (s) => s.source === "classic" && s.signupId === signupId,
  );
  return index >= 0 ? displayedFromIndex(index, fakeFront) : null;
}

/** Displayed # for a /go buy lead. */
export async function getUnifiedPositionForLead(
  leadId: string,
  eventSlug: string,
): Promise<number | null> {
  const [seats, fakeFront] = await Promise.all([
    listUnifiedQueueSeats(eventSlug),
    getFakeFront(eventSlug),
  ]);
  const index = seats.findIndex((s) => s.source === "go" && s.id === leadId);
  return index >= 0 ? displayedFromIndex(index, fakeFront) : null;
}

/** Real rank (1-based, no padding) + displayed # for a seat key in a preloaded queue. */
export function positionInSeats(
  seats: UnifiedQueueSeat[],
  predicate: (s: UnifiedQueueSeat) => boolean,
  fakeFront: number,
): { real: number; displayed: number } | null {
  const index = seats.findIndex(predicate);
  if (index < 0) return null;
  return { real: index + 1, displayed: displayedFromIndex(index, fakeFront) };
}

export function statsForSeats(
  seats: UnifiedQueueSeat[],
  fakeFront: number,
): UnifiedQueueStats {
  return {
    realSeats: seats.length,
    ticketDemand: seats.reduce((sum, s) => sum + s.quantity, 0),
    fakeFront,
    nextDisplayedPosition: seats.length + 1 + fakeFront,
  };
}

export async function getUnifiedQueueStats(
  eventSlug: string,
): Promise<UnifiedQueueStats> {
  const [seats, fakeFront] = await Promise.all([
    listUnifiedQueueSeats(eventSlug),
    getFakeFront(eventSlug),
  ]);
  return statsForSeats(seats, fakeFront);
}

export { getFakeFrontMap, defaultFakeFront };
