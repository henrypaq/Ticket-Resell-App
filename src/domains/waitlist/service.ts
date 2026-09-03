import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/analytics/log";

export async function isOnWaitlist(userId: string, eventId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function listWaitlistedEventIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("event_id")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((r) => r.event_id as string);
}

export async function joinWaitlist(userId: string, eventId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("waitlist_entries")
    .upsert({ user_id: userId, event_id: eventId }, { onConflict: "event_id,user_id" });

  if (error) throw error;
  await logEvent({ type: "waitlist_joined", userId, eventRefId: eventId });
}

export async function leaveWaitlist(userId: string, eventId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("waitlist_entries")
    .delete()
    .eq("user_id", userId)
    .eq("event_id", eventId);

  if (error) throw error;
  await logEvent({ type: "waitlist_left", userId, eventRefId: eventId });
}

export async function waitlistCount(eventId: string): Promise<number> {
  // Runs as the requesting user, so RLS scopes this to their own row. A true
  // platform-wide count is a rollup concern (event_demand_summary), not a
  // per-user read — deliberately not exposed to clients here.
  const supabase = await createClient();
  const { count } = await supabase
    .from("waitlist_entries")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count ?? 0;
}
