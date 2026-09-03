import "server-only";

import type { SourcePlatform } from "@/domains/events/source-parser";

/**
 * Tier A verification (CLAUDE.md § Phase 2): "the old ticket is invalidated
 * and a new QR is issued to the buyer through the source platform." That
 * requires an official transfer API and an organizer-scoped partnership with
 * Eventbrite/Showpass/Tixr/DICE — none of which exist yet (confirmed with the
 * team; see docs/adr/0003-*). Writing speculative HTTP calls against
 * documentation we haven't verified would be worse than an honest stub: it
 * would look integrated and silently do nothing, or break, the first time it
 * actually ran.
 *
 * So every provider below fails closed, the same pattern as
 * `stripeConfigured()` in lib/env.ts — `configured()` is false, and
 * `transferTicket()` returns `not_integrated` rather than throwing or faking a
 * result. When a real partnership exists for a platform, that provider's
 * `configured()` starts checking for real credentials and `transferTicket()`
 * gets a real implementation; nothing else in the codebase needs to change —
 * `domains/payments/release.ts` already treats "not configured" as the normal
 * fallback-to-manual-release case.
 */
export type TierATransferResult =
  | { ok: true; newTicketReference: string }
  | { ok: false; code: "not_integrated" | "transfer_failed"; message: string };

export interface TierAProvider {
  readonly platform: SourcePlatform;
  /** True once real credentials/partnership exist for this platform. */
  configured(): boolean;
  /**
   * Invalidate the seller's original ticket and issue a new one to the buyer
   * through the source platform's transfer API. Only ever called after
   * `configured()` is true.
   */
  transferTicket(input: {
    listingId: string;
    sourceEventUrl: string | null;
    sellerId: string;
    buyerId: string;
  }): Promise<TierATransferResult>;
}

function notIntegratedProvider(platform: SourcePlatform): TierAProvider {
  return {
    platform,
    configured: () => false,
    async transferTicket() {
      return {
        ok: false,
        code: "not_integrated",
        message: `Tier A transfer isn't integrated for ${platform} yet — no partner API credentials configured. Falls back to manual admin release.`,
      };
    },
  };
}

const PROVIDERS: Record<Exclude<SourcePlatform, "manual">, TierAProvider> = {
  eventbrite: notIntegratedProvider("eventbrite"),
  showpass: notIntegratedProvider("showpass"),
  tixr: notIntegratedProvider("tixr"),
  dice: notIntegratedProvider("dice"),
};

/** `manual`-sourced events have no transfer-API platform to call. */
export function getTierAProvider(platform: SourcePlatform): TierAProvider | null {
  if (platform === "manual") return null;
  return PROVIDERS[platform];
}
