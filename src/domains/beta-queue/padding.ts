import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { INTEREST_OPTIONS } from "@/lib/beta-events";

/**
 * Default when ops has never set a row. Kept at 0 so public positions are
 * real until someone explicitly pads via /ops/events.
 */
export function defaultFakeFront(_eventSlug?: string): number {
  return 0;
}

/** Map of event_slug → fake front count (ops overrides only; default 0). */
export async function getFakeFrontMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const opt of INTEREST_OPTIONS) {
    map.set(opt.value, 0);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_queue_config")
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
  return map.get(eventSlug) ?? 0;
}
