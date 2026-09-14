import { cronSecret } from "@/lib/env";
import { reconcileExpiredOffers } from "@/domains/beta-matching/service";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Sweep expired waitlist offers and advance units to the next eligible seat.
 * Correctness is lazy (reads treat past-clock rows as dead); this cron only
 * buys timely requeue. Auth matches release-escrow.
 */
export async function GET(request: Request) {
  const secret = cronSecret();
  if (!secret) {
    return fail(503, {
      code: "cron_unconfigured",
      message: "CRON_SECRET isn't set on this environment.",
    });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail(401, { code: "unauthorized", message: "Missing or invalid cron authorization." });
  }

  const summary = await reconcileExpiredOffers();
  return ok(summary);
}
