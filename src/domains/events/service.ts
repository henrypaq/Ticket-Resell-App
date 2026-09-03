import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/analytics/log";
import type { EventRow, EventWithSupply } from "@/lib/types";
import {
  listUpcomingEvents,
  searchEvents,
  type EventFilters,
} from "./data";
import { isSafePublicUrl, parseEventUrl, platformFromUrl } from "./source-parser";

/**
 * Attaches live supply counts to a set of events.
 *
 * Supply is what decides the buyer's route in Phase 1: an event with active
 * listings gets a plain feed, a sold-out/no-supply event routes to the waitlist.
 */
export async function withSupply(events: EventRow[]): Promise<EventWithSupply[]> {
  if (events.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("event_id, price")
    .in(
      "event_id",
      events.map((e) => e.id),
    )
    .eq("status", "active")
    .is("removed_at", null);

  if (error) throw error;

  const byEvent = new Map<string, number[]>();
  for (const row of data ?? []) {
    const prices = byEvent.get(row.event_id) ?? [];
    prices.push(Number(row.price));
    byEvent.set(row.event_id, prices);
  }

  return events.map((event) => {
    const prices = byEvent.get(event.id) ?? [];
    return {
      ...event,
      active_listings: prices.length,
      lowest_price: prices.length ? Math.min(...prices) : null,
    };
  });
}

export async function getFeed(filters: EventFilters = {}): Promise<EventWithSupply[]> {
  return withSupply(await listUpcomingEvents(filters));
}

export async function search(
  query: string,
  filters: EventFilters = {},
): Promise<EventWithSupply[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return withSupply(await searchEvents(trimmed, filters));
}

/**
 * Waitlist-first when there is no supply to browse — CLAUDE.md § Phase 1:
 * "for sold-out/high-demand events, buyers join a waitlist rather than seeing a
 * raw listings feed; a simple feed is fine for events with open supply."
 */
export function buyerRoute(event: EventWithSupply): "listings" | "waitlist" {
  return event.active_listings > 0 && !event.is_sold_out ? "listings" : "waitlist";
}

// ---------------------------------------------------------------------------
// Event sourcing — anyone can request, only an admin can enable resale.
// ---------------------------------------------------------------------------

export const requestEventSchema = z
  .object({
    sourceUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v ? v : undefined)),
    name: z.string().trim().min(2).max(160),
    venue: z.string().trim().min(2).max(160),
    city: z.string().trim().min(2).max(80).default("Montreal"),
    startsAt: z.string().min(4),
    originalPrice: z.coerce.number().finite().min(0).max(100_000),
    // Did the submitter accept autofilled values from the source page, or type
    // them in? Recorded as price_source so an admin knows how much scrutiny the
    // number needs before approval.
    autofilled: z.boolean().default(false),
  })
  .refine((v) => !v.sourceUrl || isSafePublicUrl(v.sourceUrl), {
    message: "That doesn't look like a public event link.",
    path: ["sourceUrl"],
  })
  .refine((v) => !Number.isNaN(new Date(v.startsAt).getTime()), {
    message: "Enter a valid date and time.",
    path: ["startsAt"],
  });

export type RequestEventInput = z.infer<typeof requestEventSchema>;

export type RequestEventResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string; field?: string };

/**
 * Creates an event in `pending`. Nothing here can produce a resale_enabled
 * event — that transition only happens through the admin console, and a
 * database trigger refuses listings against anything else, so a bug in this
 * path cannot open the price cap.
 */
export async function requestEvent(
  user: { id: string },
  input: RequestEventInput,
): Promise<RequestEventResult> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("events")
    .insert({
      name: input.name,
      venue: input.venue,
      city: input.city,
      starts_at: new Date(input.startsAt).toISOString(),
      original_price: input.originalPrice,
      source_url: input.sourceUrl ?? null,
      source_platform: input.sourceUrl ? platformFromUrl(input.sourceUrl) : "manual",
      price_source: input.autofilled ? "platform_parsed" : "user_submitted_unverified",
      status: "pending",
      submitted_by: user.id,
      verification_tier: "B",
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: "Couldn't submit that event. Try again." };
  }

  await logEvent({
    type: "event_requested",
    userId: user.id,
    eventRefId: data.id,
    metadata: {
      price_source: input.autofilled ? "platform_parsed" : "user_submitted_unverified",
      has_source_url: Boolean(input.sourceUrl),
    },
  });

  return { ok: true, eventId: data.id };
}

/** Autofill helper for the request form. Never blocks a submission. */
export async function inspectSourceUrl(url: string) {
  return parseEventUrl(url);
}
