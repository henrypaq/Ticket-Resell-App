import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { INTEREST_OPTIONS } from "@/lib/beta-events";

/** Café Campus starts hotter; everything else gets a light fake front. */
export function defaultFakeFront(eventSlug: string): number {
  return eventSlug === "cafe-campus" ? 6 : 2;
}

/** Map of event_slug → fake front count (defaults filled for known options). */
export async function getFakeFrontMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const opt of INTEREST_OPTIONS) {
    map.set(opt.value, defaultFakeFront(opt.value));
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_event_queue_config")
    .select("event_slug, fake_front");

  if (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "fake_front_map_failed", error }));
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.event_slug, Number(row.fake_front) || 0);
  }
  return map;
}

export async function getFakeFront(eventSlug: string): Promise<number> {
  const map = await getFakeFrontMap();
  return map.get(eventSlug) ?? defaultFakeFront(eventSlug);
}
