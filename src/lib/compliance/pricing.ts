/**
 * Resale price ceiling — CLAUDE_1 hard constraint 1.
 *
 * Default ceiling is the ticket's original face value. The ONLY thing that can
 * raise it is an EventAuthorization row created by an admin after a producer
 * signed a written agreement (Phase 4).
 *
 * This module is the single source of truth for that rule on the application
 * side. It is intentionally pure (no I/O, no Supabase import) so it can be unit
 * tested directly, per ARCHITECTURE.md § testing strategy. The database trigger
 * `enforce_resale_price_cap` in 0001_init.sql enforces the same rule at the
 * storage layer — this is the first line of defense, not the only one.
 */

export type PriceCapContext = {
  /** events.original_price */
  faceValue: number;
  /** event_authorizations.max_resale_price, or null when no authorization exists. */
  authorizedMaxResalePrice: number | null;
};

export type PriceValidation =
  | { ok: true; cap: number; capSource: "face_value" | "event_authorization" }
  | { ok: false; code: PriceViolationCode; message: string; cap: number };

export type PriceViolationCode =
  | "PRICE_NOT_FINITE"
  | "PRICE_NEGATIVE"
  | "RESALE_PRICE_CAP_EXCEEDED";

/**
 * The maximum price a listing for this event may be created at.
 *
 * An authorization can only ever be *consulted* here — its absence means the
 * cap is face value, full stop. There is no seller-side override path.
 */
export function resolvePriceCap(ctx: PriceCapContext): {
  cap: number;
  capSource: "face_value" | "event_authorization";
} {
  if (ctx.authorizedMaxResalePrice === null || ctx.authorizedMaxResalePrice === undefined) {
    return { cap: ctx.faceValue, capSource: "face_value" };
  }
  return { cap: ctx.authorizedMaxResalePrice, capSource: "event_authorization" };
}

export function validateListingPrice(price: number, ctx: PriceCapContext): PriceValidation {
  const { cap, capSource } = resolvePriceCap(ctx);

  if (!Number.isFinite(price)) {
    return { ok: false, code: "PRICE_NOT_FINITE", message: "Enter a valid price.", cap };
  }
  if (price < 0) {
    return { ok: false, code: "PRICE_NEGATIVE", message: "Price cannot be negative.", cap };
  }
  if (price > cap) {
    return {
      ok: false,
      code: "RESALE_PRICE_CAP_EXCEEDED",
      cap,
      message: `Listings cannot exceed ${formatCad(cap)} for this event.`,
    };
  }

  return { ok: true, cap, capSource };
}

export function formatCad(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
}
