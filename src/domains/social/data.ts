import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MinimalEventRow } from "@/lib/types";

export type PublicProfile = { id: string; displayName: string; handle: string };

function toPublicProfile(row: { id: string; display_name: string | null; handle: string | null }): PublicProfile {
  return { id: row.id, displayName: row.display_name ?? "Someone", handle: row.handle ?? "" };
}

export async function getProfileByHandle(handle: string): Promise<PublicProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, handle")
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw error;
  return data ? toPublicProfile(data) : null;
}

export async function searchProfilesByHandle(query: string, limit = 8): Promise<PublicProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, handle")
    .ilike("handle", `%${query}%`)
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toPublicProfile);
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export async function followCounts(userId: string): Promise<{ followers: number; following: number }> {
  const supabase = await createClient();
  const [followers, following] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", userId),
    supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

/** Who a user follows — powers the Friends section on /profile. */
export async function listFollowing(userId: string): Promise<PublicProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follows")
    .select("followee:profiles!follows_followee_id_fkey(id, display_name, handle)")
    .eq("follower_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => toPublicProfile(row.followee as unknown as Parameters<typeof toPublicProfile>[0]));
}

export async function isAttending(userId: string, eventId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_confirmations")
    .select("user_id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/**
 * Followees confirmed for this event — runs as the viewer, so RLS already
 * limits this to 'followers'-visibility rows from people the viewer follows
 * (see attendance_read in migration 0008). The viewer's own row is filtered
 * out here since this list means "friends going", not "you're going".
 */
export async function listFriendsAttendingEvent(viewerId: string, eventId: string): Promise<PublicProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_confirmations")
    .select("user:profiles!attendance_confirmations_user_id_fkey(id, display_name, handle)")
    .eq("event_id", eventId)
    .neq("user_id", viewerId);
  if (error) throw error;
  return (data ?? []).map((row) => toPublicProfile(row.user as unknown as Parameters<typeof toPublicProfile>[0]));
}

/**
 * Upcoming events a profile is attending, visible to the requesting viewer —
 * runs as the viewer, so the same RLS scoping applies (their own profile
 * sees everything; anyone else sees only 'followers'-visibility rows, and
 * only if the viewer actually follows them).
 */
export async function listUpcomingAttendance(profileUserId: string): Promise<MinimalEventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_confirmations")
    .select("event:events(id, name, venue, city, starts_at, flyer_url)")
    .eq("user_id", profileUserId);
  if (error) throw error;

  const now = Date.now();
  return (data ?? [])
    .map((row) => row.event as unknown as MinimalEventRow | null)
    .filter((e): e is MinimalEventRow => e !== null && +new Date(e.starts_at) >= now)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
}
