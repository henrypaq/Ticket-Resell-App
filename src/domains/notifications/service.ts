import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { NotificationRow } from "@/lib/types";

/**
 * Read side of the legacy Phase 1 in-app inbox. Nothing writes new rows any
 * more — the waitlist-match sender was retired with the beta email flows.
 */

export async function listNotifications(userId: string): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, event_ref_id, listing_ref_id, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function countUnread(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}

export async function markAllRead(userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}
