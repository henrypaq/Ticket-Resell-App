import "server-only";

import { z } from "zod";
import { getAuthorizedMaxResalePrice, getEventById } from "@/domains/events/data";
import { buildDisclosureSnapshot } from "@/lib/compliance/disclosure";
import { validateListingPrice } from "@/lib/compliance/pricing";
import { logEvent } from "@/lib/analytics/log";
import { notifyWaitlistOfMatch } from "@/domains/notifications/service";
import { hashBarcode, validateTicketEvidenceFile } from "@/lib/verification/ticket-evidence";
import { getTierAProvider } from "@/lib/verification/tier-a-providers";
import type { SourcePlatform } from "@/domains/events/source-parser";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachTicketEvidence, findLiveListingByBarcodeHash, getListingById, insertListing } from "./data";
import type { ListingRow } from "@/lib/types";

export const createListingSchema = z.object({
  eventId: z.string().uuid(),
  price: z.coerce.number().finite().min(0),
  // Phase 1 verification is manual attestation; Phase 2 adds a required
  // barcode/ticket-ID for Tier B events, checked for duplicates below — see
  // the `verification_tier === "B"` branch in createListing.
  attestation: z.literal(true, {
    message: "You must confirm you hold a valid ticket for this event.",
  }),
  ticketBarcode: z.string().trim().min(1).max(200).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

export type CreateListingResult =
  | { ok: true; listing: ListingRow }
  | { ok: false; error: string; field?: "price" | "attestation" | "eventId" | "ticketBarcode" };

/**
 * The supply-side path: attest, price at or below the cap, verify Tier B
 * evidence, go live with a frozen disclosure snapshot, then fan out match
 * notifications.
 *
 * Price validation happens here on the server regardless of what the UI did —
 * SECURITY.md non-negotiable: never a client-side-only check for anything
 * compliance-relevant. The database trigger backstops this a third time. The
 * same applies to the Tier B duplicate-barcode check below: a partial unique
 * index on listings physically enforces it too.
 */
export async function createListing(
  sellerId: string,
  input: CreateListingInput,
): Promise<CreateListingResult> {
  const event = await getEventById(input.eventId);
  if (!event) {
    return { ok: false, error: "That event no longer exists.", field: "eventId" };
  }

  // Only resale_enabled events may be listed against (CLAUDE.md § Phase 1 —
  // "no path skips this step in v1"). Checked here, and again by the
  // enforce_resale_enabled_event trigger, which is what makes it structural.
  if (event.status !== "resale_enabled") {
    return {
      ok: false,
      field: "eventId",
      error:
        event.status === "pending"
          ? "That event is still waiting on admin approval. You'll be notified when it's open for resale."
          : "That event isn't open for resale yet.",
    };
  }

  const authorizedMax = await getAuthorizedMaxResalePrice(event.id);
  const validation = validateListingPrice(input.price, {
    faceValue: Number(event.original_price),
    authorizedMaxResalePrice: authorizedMax,
  });

  if (!validation.ok) {
    return { ok: false, error: validation.message, field: "price" };
  }

  // Only a *configured* Tier A provider verifies via the source platform's
  // transfer API at release time (src/lib/verification/tier-a-providers.ts) —
  // no evidence needed at listing time. Everything else, which today is
  // every event regardless of its verification_tier label since no Tier A
  // provider has real credentials yet, has no such signal, so CLAUDE.md §
  // Phase 2 requires a barcode/ticket-ID here, checked against every other
  // live listing for an exact duplicate before this one is allowed to go live
  // (SECURITY.md § duplicate detection: "before allowing a new one live", not
  // a soft flag). Gating on the provider's actual configured() state — not the
  // tier label — means a Tier A event stays covered by duplicate detection
  // until a real integration exists for its platform, and self-corrects the
  // day one does.
  const tierAProvider = getTierAProvider(event.source_platform as SourcePlatform);
  const requiresTicketEvidence = !tierAProvider || !tierAProvider.configured();

  let ticketBarcodeHash: string | null = null;
  if (requiresTicketEvidence) {
    if (!input.ticketBarcode) {
      return {
        ok: false,
        field: "ticketBarcode",
        error: "Enter the barcode or ticket ID from your ticket so we can check it isn't already listed.",
      };
    }

    ticketBarcodeHash = hashBarcode(input.ticketBarcode);
    const duplicate = await findLiveListingByBarcodeHash(ticketBarcodeHash);
    if (duplicate) {
      await logEvent({
        type: "duplicate_listing_flagged",
        userId: sellerId,
        eventRefId: event.id,
        metadata: { attempted_by: sellerId, existing_listing_id: duplicate.id },
      });
      return {
        ok: false,
        field: "ticketBarcode",
        error: "That ticket has already been listed on Passe. If this is a mistake, contact support.",
      };
    }
  }

  const disclosure = buildDisclosureSnapshot({
    event: { ...event, original_price: Number(event.original_price) },
    listingPrice: input.price,
    authorizedMaxResalePrice: authorizedMax,
    ticketEvidenceSubmitted: ticketBarcodeHash !== null,
  });

  let listing: ListingRow;
  try {
    listing = await insertListing({
      eventId: event.id,
      sellerId,
      price: input.price,
      disclosureSnapshot: disclosure,
      ticketBarcodeHash,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("RESALE_PRICE_CAP_EXCEEDED")) {
      return { ok: false, error: "That price is above the cap for this event.", field: "price" };
    }
    if (message.includes("EVENT_NOT_RESALE_ENABLED")) {
      return { ok: false, error: "That event isn't open for resale yet.", field: "eventId" };
    }
    // Race with another insert of the same barcode between the check above and
    // this insert — the partial unique index is what actually closes that
    // window; the app-level check is the friendly error path.
    if (message.includes("listings_ticket_barcode_hash_live_idx")) {
      return {
        ok: false,
        field: "ticketBarcode",
        error: "That ticket has already been listed on Passe. If this is a mistake, contact support.",
      };
    }
    throw err;
  }

  await logEvent({
    type: "listing_created",
    userId: sellerId,
    eventRefId: event.id,
    listingRefId: listing.id,
    metadata: {
      price: input.price,
      face_value: Number(event.original_price),
      price_cap_source: validation.capSource,
      verification_tier: event.verification_tier,
    },
  });

  if (requiresTicketEvidence) {
    await logEvent({
      type: "verification_tier_b_used",
      userId: sellerId,
      eventRefId: event.id,
      listingRefId: listing.id,
    });
  }

  // Match notification (CLAUDE_1 Phase 1). Failure here must not fail the
  // listing — the ticket is already live and correct.
  try {
    await notifyWaitlistOfMatch({ event, listing, excludeUserId: sellerId });
  } catch (err) {
    console.warn(
      JSON.stringify({ level: "warn", msg: "match_notify_failed", listing_id: listing.id, error: String(err) }),
    );
  }

  return { ok: true, listing };
}

export type AttachEvidenceResult = { ok: true } | { ok: false; error: string };

/**
 * Optional Tier B evidence photo/PDF, uploaded after the listing already
 * exists (the barcode above is what gates listing creation; the photo is
 * best-effort supporting evidence for a later dispute — see CLAUDE.md §
 * Phase 2 "seller uploads the ticket"). Never fails listing creation itself;
 * callers treat a failure here as non-fatal and surface it separately.
 *
 * Validates the actual bytes (magic-byte sniff, size cap) rather than trusting
 * the client-reported MIME type (SECURITY.md § file uploads), then writes with
 * the service role — no client role has insert access to the ticket-evidence
 * bucket at all (see migration 0007).
 */
export async function attachTicketEvidencePhoto(
  sellerId: string,
  listingId: string,
  file: { bytes: Uint8Array; name: string },
): Promise<AttachEvidenceResult> {
  const listing = await getListingById(listingId);
  if (!listing || listing.seller_id !== sellerId) {
    return { ok: false, error: "Listing not found." };
  }

  const validation = validateTicketEvidenceFile(file.bytes);
  if (!validation.ok) {
    return { ok: false, error: validation.message };
  }

  const admin = createAdminClient();
  const path = `${sellerId}/${listingId}/${Date.now()}.${validation.ext}`;
  const { error: uploadError } = await admin.storage
    .from("ticket-evidence")
    .upload(path, file.bytes, { contentType: validation.mime, upsert: false });

  if (uploadError) {
    return { ok: false, error: "Upload failed. You can try again from your listing." };
  }

  await attachTicketEvidence(listingId, path);
  return { ok: true };
}

