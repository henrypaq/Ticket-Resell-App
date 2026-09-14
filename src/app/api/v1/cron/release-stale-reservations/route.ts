import { cronSecret } from "@/lib/env";
import { releaseStaleReservations } from "@/domains/payments/stale-reservations";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Clears Phase 1 listings left in `reserved` after abandoned checkout.
 * Stripe webhooks cover payment_failed/canceled; this catches the no-webhook case.
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

  const summary = await releaseStaleReservations();
  return ok(summary);
}
