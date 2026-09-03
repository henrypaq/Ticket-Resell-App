import { buildFeeBreakdown, type FeeBreakdown } from "./fees";
import { resolvePriceCap } from "./pricing";

/**
 * Pre-purchase disclosure — CLAUDE_1 hard constraint 3.
 *
 * Every listing must disclose, before purchase: the original ticket price, the
 * event/seat details, that this is a resale (not primary) listing, and the
 * itemized fee breakdown. This builds that payload once so the same object is
 * both rendered to the buyer and frozen into listings.disclosure_snapshot —
 * the two can't drift, which is what makes the Phase 4 audit log meaningful.
 */

// Bumped for Phase 2: the verification block gained a new method
// ("seller_attestation_with_ticket_id") and note text — CLAUDE.md "when a
// design decision touches... disclosure, flag it explicitly."
export const DISCLOSURE_VERSION = "2026-09-03.1";

export type DisclosureEvent = {
  id: string;
  name: string;
  venue: string;
  city: string;
  starts_at: string;
  original_price: number;
  verification_tier: "A" | "B";
  source_platform: string;
};

export type DisclosureSnapshot = {
  version: string;
  generatedAt: string;
  isResale: true;
  listingType: "resale";
  event: {
    id: string;
    name: string;
    venue: string;
    city: string;
    startsAt: string;
    sourcePlatform: string;
  };
  originalTicketPrice: number;
  priceCap: number;
  priceCapSource: "face_value" | "event_authorization";
  fees: FeeBreakdown;
  verification: {
    tier: "A" | "B";
    method: "seller_attestation" | "seller_attestation_with_ticket_id";
    note: string;
  };
};

export function buildDisclosureSnapshot(args: {
  event: DisclosureEvent;
  listingPrice: number;
  authorizedMaxResalePrice: number | null;
  /**
   * True once a Tier B seller has submitted a barcode/ticket-ID, checked
   * against every other listing for an exact duplicate (CLAUDE.md § Phase 2).
   * Tier A stays attestation-only until a real transfer-API partnership
   * exists — see src/lib/verification/tier-a-providers.ts.
   */
  ticketEvidenceSubmitted?: boolean;
}): DisclosureSnapshot {
  const { cap, capSource } = resolvePriceCap({
    faceValue: args.event.original_price,
    authorizedMaxResalePrice: args.authorizedMaxResalePrice,
  });

  return {
    version: DISCLOSURE_VERSION,
    generatedAt: new Date().toISOString(),
    isResale: true,
    listingType: "resale",
    event: {
      id: args.event.id,
      name: args.event.name,
      venue: args.event.venue,
      city: args.event.city,
      startsAt: args.event.starts_at,
      sourcePlatform: args.event.source_platform,
    },
    originalTicketPrice: args.event.original_price,
    priceCap: cap,
    priceCapSource: capSource,
    fees: buildFeeBreakdown(args.listingPrice),
    verification: args.ticketEvidenceSubmitted
      ? {
          tier: args.event.verification_tier,
          method: "seller_attestation_with_ticket_id",
          note:
            "The seller has attested they hold a valid ticket and submitted its ticket ID, which was checked against every other listing on the platform for an exact duplicate. This is not authenticity verification by the event organizer.",
        }
      : {
          tier: args.event.verification_tier,
          method: "seller_attestation",
          note:
            "The seller has attested they hold a valid ticket. Automated ticket verification arrives in a later release.",
        },
  };
}
