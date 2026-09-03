import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { stripeConfigured } from "@/lib/env";
import { releaseCore } from "./release";

/**
 * The unattended half of the Tier B release trigger (CLAUDE.md § Phase 2:
 * "buyer confirms entry, with a timeout/dispute path"). Tier A has no
 * timeout — it has no verification signal at all yet (see
 * lib/verification/tier-a-providers.ts), so it stays on manual admin release
 * until a real transfer-API partnership exists.
 *
 * The clock starts at the event, not the purchase — a buyer can't confirm (or
 * be assumed to have) entered an event that hasn't happened. Docs/adr/0003
 * covers why this runs as a scheduled sweep (Vercel Cron hitting
 * /api/v1/cron/release-escrow) instead of a queued per-transaction timer:
 * there's no job queue yet (README known gaps), and a periodic idempotent
 * sweep is the simplest mechanism that's still a real scheduled job rather
 * than fire-and-forget request-time work (ARCHITECTURE.md § background work).
 */
const AUTO_RELEASE_DELAY_HOURS = 24;

export type AutoReleaseSummary = {
  checked: number;
  released: number;
  errors: { transactionId: string; error: string }[];
};

type CandidateRow = {
  id: string;
  listing: {
    event: { starts_at: string; doors_close_at: string | null; verification_tier: string } | null;
  } | null;
};

export async function releaseExpiredEscrows(): Promise<AutoReleaseSummary> {
  // releaseCore calls Stripe unconditionally — fail closed here the same way
  // every other release entry point does, rather than letting the sweep throw
  // on the first eligible row.
  if (!stripeConfigured()) return { checked: 0, released: 0, errors: [] };

  const admin = createAdminClient();

  // Held is the full candidate set. Deliberately does NOT filter out rows
  // where buyer_confirmed_at is already set: a buyer's confirmation can have
  // recorded successfully while the Transfer itself failed (no payout account
  // yet, a transient Stripe error) — those rows stay 'held' and must remain
  // eligible for the sweep to retry, or only a manual admin release ever
  // recovers them. Dispute is excluded by definition (escrow_status would be
  // 'disputed', not 'held') and releaseCore re-checks escrow_status anyway
  // before ever calling Stripe.
  const { data, error } = await admin
    .from("transactions")
    .select("id, listing:listings(event:events(starts_at, doors_close_at, verification_tier))")
    .eq("escrow_status", "held");

  if (error) throw error;

  const now = Date.now();
  const summary: AutoReleaseSummary = { checked: 0, released: 0, errors: [] };

  for (const row of (data ?? []) as unknown as CandidateRow[]) {
    summary.checked++;
    const event = row.listing?.event;
    if (!event || event.verification_tier !== "B") continue;

    const anchor = event.doors_close_at ?? event.starts_at;
    const cutoff = new Date(anchor).getTime() + AUTO_RELEASE_DELAY_HOURS * 60 * 60 * 1000;
    if (cutoff > now) continue;

    try {
      const result = await releaseCore(row.id, { type: "auto_timeout" });
      if (result.ok) summary.released++;
      else summary.errors.push({ transactionId: row.id, error: result.error });
    } catch (err) {
      // releaseCore throws on a Stripe/DB failure rather than returning
      // {ok:false} — one bad row (network blip, a retrieve failure) must not
      // abort the rest of the sweep.
      summary.errors.push({ transactionId: row.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return summary;
}
