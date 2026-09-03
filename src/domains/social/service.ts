import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/analytics/log";

export async function followUser(followerId: string, followeeId: string): Promise<void> {
  // Mirrors the DB's follows_no_self_follow check — short-circuit rather than
  // round-tripping a constraint-violation error for something the UI never
  // offers anyway (there's no follow button on your own profile).
  if (followerId === followeeId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("follows")
    .upsert({ follower_id: followerId, followee_id: followeeId }, { onConflict: "follower_id,followee_id" });
  if (error) throw error;

  await logEvent({ type: "friend_added", userId: followerId, metadata: { followee_id: followeeId } });
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId);
  if (error) throw error;
}

/**
 * Always writes 'followers' visibility — the only value this app's UI ever
 * offers (see migration 0008's comment on why "private" exists at all: a user
 * can still confirm attendance without broadcasting it, but there's no UI
 * control for that distinction yet, matching "give people a reason to open
 * the app" rather than building a privacy-settings surface Phase 3 doesn't
 * ask for).
 */
export async function confirmAttendance(userId: string, eventId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_confirmations")
    .upsert({ user_id: userId, event_id: eventId, visibility: "followers" }, { onConflict: "user_id,event_id" });
  if (error) throw error;

  await logEvent({ type: "attendance_confirmed", userId, eventRefId: eventId });
}

export async function unconfirmAttendance(userId: string, eventId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_confirmations")
    .delete()
    .eq("user_id", userId)
    .eq("event_id", eventId);
  if (error) throw error;
}
