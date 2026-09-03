import { cronSecret } from "@/lib/env";
import { releaseExpiredEscrows } from "@/domains/payments/auto-release";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron target for the Tier B auto-release timeout (CLAUDE.md § Phase
 * 2). Invoked on a schedule declared in vercel.json — Vercel Cron requests are
 * GETs. Guarded by CRON_SECRET rather than left open: this endpoint moves
 * real money, so it fails closed (503) if the secret isn't configured, and
 * 401s any request that doesn't present it, the same fail-closed shape as
 * stripeConfigured()/PAYMENTS_UNCONFIGURED elsewhere in payments.
 */
export async function GET(request: Request) {
  const secret = cronSecret();
  if (!secret) {
    return fail(503, { code: "cron_unconfigured", message: "CRON_SECRET isn't set on this environment." });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail(401, { code: "unauthorized", message: "Missing or invalid cron authorization." });
  }

  const summary = await releaseExpiredEscrows();
  return ok(summary);
}
