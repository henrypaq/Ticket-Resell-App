import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type OpsEventRequest = {
  id: string;
  name: string;
  details: string | null;
  createdAt: string;
  seenAt: string | null;
  resolvedAt: string | null;
  memberEmail: string | null;
  memberName: string | null;
};

export type OpsBadgeCounts = {
  /** Unseen event requests (iOS-style tab badge). */
  eventRequests: number;
  /** Transactions needing ops attention. */
  transactions: number;
};

/** Count of event requests ops hasn’t opened yet. */
export async function countUnseenEventRequests(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("beta_member_event_requests")
    .select("id", { count: "exact", head: true })
    .is("seen_at", null)
    .is("resolved_at", null);
  if (error) {
    console.warn(
      JSON.stringify({ level: "warn", msg: "event_request_unseen_count_failed", error }),
    );
    return 0;
  }
  return count ?? 0;
}

export async function listOpsEventRequests(): Promise<OpsEventRequest[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_member_event_requests")
    .select("id, name, details, created_at, seen_at, resolved_at, member_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.warn(
      JSON.stringify({ level: "warn", msg: "event_request_list_failed", error }),
    );
    return [];
  }

  const memberIds = [
    ...new Set(
      (data ?? [])
        .map((r) => r.member_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const memberById = new Map<string, { email: string | null; name: string | null }>();
  if (memberIds.length > 0) {
    const { data: members } = await admin
      .from("beta_members")
      .select("id, email, name")
      .in("id", memberIds);
    for (const m of members ?? []) {
      memberById.set(m.id as string, {
        email: (m.email as string | null) ?? null,
        name: (m.name as string | null) ?? null,
      });
    }
  }

  return (data ?? []).map((r) => {
    const member = r.member_id ? memberById.get(r.member_id as string) : undefined;
    return {
      id: r.id as string,
      name: r.name as string,
      details: (r.details as string | null) ?? null,
      createdAt: r.created_at as string,
      seenAt: (r.seen_at as string | null) ?? null,
      resolvedAt: (r.resolved_at as string | null) ?? null,
      memberEmail: member?.email ?? null,
      memberName: member?.name ?? null,
    };
  });
}

/** Mark all currently-unseen open requests as seen (opens the Requests tab). */
export async function markAllEventRequestsSeen(): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("beta_member_event_requests")
    .update({ seen_at: now })
    .is("seen_at", null)
    .is("resolved_at", null);
  if (error) {
    console.warn(
      JSON.stringify({ level: "warn", msg: "event_request_mark_seen_failed", error }),
    );
  }
}

export async function markEventRequestResolved(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("beta_member_event_requests")
    .update({ resolved_at: now, seen_at: now })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getOpsBadgeCounts(
  transactionAttention = 0,
): Promise<OpsBadgeCounts> {
  const eventRequests = await countUnseenEventRequests();
  return { eventRequests, transactions: transactionAttention };
}
