import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatCad } from "@/lib/compliance/pricing";
import type { EventRow, ListingRow, NotificationRow } from "@/lib/types";

/**
 * Phase 1 match notification.
 *
 * Delivery is an in-app notification row. Web Push through the service worker
 * is deliberately deferred: CLAUDE_1 flags iOS Safari's web-push support as
 * weak, and a half-built push path would be worse than an honest in-app one.
 * The `notifications` table is the delivery-agnostic seam — adding push later
 * means adding a sender, not reworking this.
 *
 * Runs with the service role because it writes rows belonging to *other* users
 * (everyone on the waitlist), which RLS correctly forbids the seller from doing.
 */
export async function notifyWaitlistOfMatch(args: {
  event: EventRow;
  listing: ListingRow;
  excludeUserId: string;
}): Promise<number> {
  const admin = createAdminClient();

  const { data: waiting, error } = await admin
    .from("waitlist_entries")
    .select("user_id")
    .eq("event_id", args.event.id)
    .neq("user_id", args.excludeUserId);

  if (error) throw error;
  if (!waiting?.length) return 0;

  const rows = waiting.map((w) => ({
    user_id: w.user_id,
    type: "waitlist_match",
    title: `A ticket just dropped for ${args.event.name}`,
    body: `${formatCad(Number(args.listing.price))} · ${args.event.venue}. You liked this one.`,
    event_ref_id: args.event.id,
    listing_ref_id: args.listing.id,
  }));

  const { error: insertError } = await admin.from("notifications").insert(rows);
  if (insertError) throw insertError;

  return rows.length;
}

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
