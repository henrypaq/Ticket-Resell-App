import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BETA_EVENTS,
  BETA_WEEKDAYS,
  type BetaEvent,
  type BetaWeekday,
  eventListedOnNight,
  groupEventsByUpcomingDays,
  currentNightlifeWeekday,
  nightlifeDateKey,
} from "@/lib/beta-events";

type CatalogRow = {
  slug: string;
  name: string;
  venue: string;
  city: string;
  blurb: string;
  flyer_url: string;
  flyer_path: string | null;
  days: string[] | null;
  extra_date_keys: string[] | null;
  supported: boolean;
  entry_note: string | null;
  doors_hour: number | null;
  fixed_price_each: number | string | null;
  list_price_each: number | string | null;
  discount_each: number | string | null;
  discount_label: string | null;
  service_fee_each: number | string | null;
};

function optionalMoney(value: number | string | null | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function isWeekday(value: string): value is BetaWeekday {
  return (BETA_WEEKDAYS as readonly string[]).includes(value);
}

function rowToEvent(row: CatalogRow): BetaEvent {
  const days = (row.days ?? []).filter(isWeekday);
  const extra = (row.extra_date_keys ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const fixed = optionalMoney(row.fixed_price_each);
  return {
    slug: row.slug,
    name: row.name,
    venue: row.venue,
    city: row.city || "Montreal",
    blurb: row.blurb || "",
    flyerUrl: row.flyer_url,
    days,
    extraDateKeys: extra.length ? extra : undefined,
    supported: Boolean(row.supported),
    entryNote: row.entry_note || undefined,
    doorsHour: row.doors_hour ?? undefined,
    fixedPriceEach: fixed,
    listPriceEach: optionalMoney(row.list_price_each),
    discountEach: optionalMoney(row.discount_each),
    discountLabel: row.discount_label?.trim() || undefined,
    serviceFeeEach: optionalMoney(row.service_fee_each),
  };
}

async function fetchDbCatalog(): Promise<BetaEvent[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("beta_event_catalog")
      .select(
        "slug, name, venue, city, blurb, flyer_url, flyer_path, days, extra_date_keys, supported, entry_note, doors_hour, fixed_price_each, list_price_each, discount_each, discount_label, service_fee_each",
      )
      .order("name", { ascending: true });
    if (error) {
      console.warn(JSON.stringify({ level: "warn", msg: "beta_event_catalog_load_failed", error }));
      return [];
    }
    return (data ?? []).map((row) => rowToEvent(row as CatalogRow));
  } catch (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "beta_event_catalog_load_threw", error: String(error) }));
    return [];
  }
}

/**
 * Static seeds + DB rows. DB wins on slug collision so ops can override Café
 * Campus schedule / flyer without a redeploy.
 */
export const loadBetaCatalog = cache(async (): Promise<BetaEvent[]> => {
  const fromDb = await fetchDbCatalog();
  const map = new Map<string, BetaEvent>();
  for (const event of BETA_EVENTS) map.set(event.slug, event);
  for (const event of fromDb) map.set(event.slug, event);
  return [...map.values()];
});

export async function getBetaEventBySlug(slug: string): Promise<BetaEvent | undefined> {
  const catalog = await loadBetaCatalog();
  return catalog.find((e) => e.slug === slug);
}

export async function getSupportedBetaEvents(): Promise<BetaEvent[]> {
  return (await loadBetaCatalog()).filter((e) => e.supported);
}

export async function getTonightBetaEvents(from: Date = new Date()): Promise<BetaEvent[]> {
  const day = currentNightlifeWeekday(from);
  const dateKey = nightlifeDateKey(from);
  return (await getSupportedBetaEvents()).filter((e) => eventListedOnNight(e, day, dateKey));
}

export async function getBoardSelectableEvents(from: Date = new Date()): Promise<BetaEvent[]> {
  const seen = new Set<string>();
  const out: BetaEvent[] = [];
  for (const [, events] of groupEventsByUpcomingDays(await getSupportedBetaEvents(), from)) {
    for (const event of events) {
      if (seen.has(event.slug)) continue;
      seen.add(event.slug);
      out.push(event);
    }
  }
  return out;
}

export async function listCatalogRowsForOps(): Promise<
  (BetaEvent & { source: "db" | "static"; flyerPath: string | null })[]
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("beta_event_catalog")
    .select(
      "slug, name, venue, city, blurb, flyer_url, flyer_path, days, extra_date_keys, supported, entry_note, doors_hour, fixed_price_each, list_price_each, discount_each, discount_label, service_fee_each",
    )
    .order("updated_at", { ascending: false });

  const dbEvents = (data ?? []).map((row) => ({
    ...rowToEvent(row as CatalogRow),
    source: "db" as const,
    flyerPath: (row as CatalogRow).flyer_path,
  }));
  const dbSlugs = new Set(dbEvents.map((e) => e.slug));
  const staticOnly = BETA_EVENTS.filter((e) => !dbSlugs.has(e.slug)).map((e) => ({
    ...e,
    source: "static" as const,
    flyerPath: null,
  }));
  return [...dbEvents, ...staticOnly];
}

export function publicFlyerUrlFromPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_PROJECT_URL ?? "";
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/beta-event-flyers/${path}`;
}
