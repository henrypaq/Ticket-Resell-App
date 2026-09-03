import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ListingRow, ListingWithEventRow, MinimalEventRow } from "@/lib/types";

const LISTING_COLUMNS =
  "id, event_id, seller_id, price, status, disclosure_snapshot, reserved_by, reserved_at, flagged_at, flagged_reason, removed_at, ticket_barcode_hash, ticket_evidence_path, ticket_evidence_uploaded_at, created_at";

export async function listActiveListingsForEvent(eventId: string): Promise<ListingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("event_id", eventId)
    .eq("status", "active")
    .is("removed_at", null)
    .order("price", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ListingRow[];
}

export async function getListingById(id: string): Promise<ListingRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as ListingRow | null) ?? null;
}

/** For the tickets page — a seller needs the event's date and venue to sort and label each listing. */
export async function listListingsBySeller(sellerId: string): Promise<ListingWithEventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(`${LISTING_COLUMNS}, event:events(id, name, venue, city, starts_at, flyer_url)`)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const { event, ...listing } = row as typeof row & { event: MinimalEventRow };
    return { ...listing, event } as ListingWithEventRow;
  });
}

export async function insertListing(input: {
  eventId: string;
  sellerId: string;
  price: number;
  disclosureSnapshot: unknown;
  ticketBarcodeHash?: string | null;
}): Promise<ListingRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .insert({
      event_id: input.eventId,
      seller_id: input.sellerId,
      price: input.price,
      disclosure_snapshot: input.disclosureSnapshot,
      ticket_barcode_hash: input.ticketBarcodeHash ?? null,
    })
    .select(LISTING_COLUMNS)
    .single();

  if (error) throw error;
  return data as ListingRow;
}

/**
 * Duplicate-listing detection (CLAUDE.md § Phase 2, SECURITY.md § duplicate
 * detection): "has this exact barcode/ticket ID been listed before?" Only
 * matches a *live* listing (active/reserved/sold, not removed) — the same
 * predicate the DB's partial unique index enforces, so a legitimate re-list
 * after a refund isn't blocked. Live listings are publicly readable under RLS
 * (see 0003's listings_read_authenticated policy), so this runs as the
 * calling user rather than needing the service role.
 */
export async function findLiveListingByBarcodeHash(hash: string): Promise<ListingRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("ticket_barcode_hash", hash)
    .is("removed_at", null)
    .in("status", ["active", "reserved", "sold"])
    .maybeSingle();

  if (error) throw error;
  return (data as ListingRow | null) ?? null;
}

/** Attaches the (optional) uploaded ticket-evidence photo/PDF after the listing exists. */
export async function attachTicketEvidence(listingId: string, path: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("listings")
    .update({ ticket_evidence_path: path, ticket_evidence_uploaded_at: new Date().toISOString() })
    .eq("id", listingId);
  if (error) throw error;
}
