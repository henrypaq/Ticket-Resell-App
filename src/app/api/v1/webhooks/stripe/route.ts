import { createAdminClient } from "@/lib/supabase/admin";
import { stripeConfigured, stripeWebhookSecret } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { fail, ok } from "@/lib/api";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook: verify signature, persist the raw event, return fast, THEN
 * process (ARCHITECTURE.md § background work — "verify-then-enqueue").
 *
 * Phase 1 has no automated release — that's Phase 2 — so this intentionally
 * does not touch escrow_status. What it does: keep transactions.verification_status
 * honest if a charge that looked like it succeeded actually failed or got
 * disputed, so the admin console never shows a stale picture. Idempotent by
 * primary-keying stripe_events on the Stripe event id.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return fail(503, { code: "payments_unconfigured", message: "Payments aren't configured." });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature ?? "", stripeWebhookSecret());
  } catch {
    return fail(400, { code: "invalid_signature", message: "Signature verification failed." });
  }

  const admin = createAdminClient();

  // Persist first — this is what makes retries idempotent regardless of what
  // happens below.
  const { error: insertError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type, payload: event as unknown as Record<string, unknown> });

  if (insertError) {
    // Unique violation on id means we've already recorded (and presumably
    // processed) this event — that's a successful retry, not a failure.
    if (insertError.code === "23505") return ok({ received: true, duplicate: true });
    throw insertError;
  }

  await processEvent(admin, event);

  await admin
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", event.id);

  return ok({ received: true });
}

async function processEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await admin
        .from("transactions")
        .update({ verification_status: "payment_failed" })
        .eq("stripe_payment_intent_id", intent.id)
        .eq("escrow_status", "held");
      break;
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
      await admin
        .from("transactions")
        .update({ escrow_status: "disputed", verification_status: "disputed" })
        .eq("stripe_charge_id", chargeId);
      break;
    }
    default:
      // Everything else is recorded in stripe_events for later use, but has no
      // Phase 1 side effect.
      break;
  }
}
