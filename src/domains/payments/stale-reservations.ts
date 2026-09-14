import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Phase 1 reservations can strand a listing if the buyer abandons checkout
 * before Stripe fires payment_failed/canceled. Sweep anything still `reserved`
 * past this TTL back to `active`.
 */
const STALE_RESERVATION_MINUTES = 30;

export type StaleReservationSummary = {
  checked: number;
  released: number;
  errors: { listingId: string; error: string }[];
};

export async function releaseStaleReservations(
  now = new Date(),
): Promise<StaleReservationSummary> {
  const admin = createAdminClient();
  const cutoff = new Date(now.getTime() - STALE_RESERVATION_MINUTES * 60_000).toISOString();
  const summary: StaleReservationSummary = { checked: 0, released: 0, errors: [] };

  const { data: rows, error } = await admin
    .from("listings")
    .select("id")
    .eq("status", "reserved")
    .lt("reserved_at", cutoff)
    .limit(200);

  if (error) {
    summary.errors.push({ listingId: "*", error: error.message });
    return summary;
  }

  summary.checked = rows?.length ?? 0;

  for (const row of rows ?? []) {
    const { error: updateError } = await admin
      .from("listings")
      .update({ status: "active", reserved_by: null, reserved_at: null })
      .eq("id", row.id)
      .eq("status", "reserved");
    if (updateError) {
      summary.errors.push({ listingId: row.id, error: updateError.message });
      continue;
    }
    summary.released += 1;
  }

  return summary;
}
