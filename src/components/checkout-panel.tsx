"use client";

import { useActionState, useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { startPurchaseAction } from "@/domains/payments/actions";
import { idlePurchaseState } from "@/domains/payments/state";
import { formatCad } from "@/lib/compliance/pricing";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripeClient(publishableKey: string) {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

/**
 * Buyer-facing checkout. Charges into the platform's Stripe balance and holds
 * there — CLAUDE.md § Phase 1 manual escrow. No transfer to the seller happens
 * client-side or automatically; that's a separate admin-triggered action.
 *
 * `paymentsEnabled` comes from the server (stripeConfigured()). When false this
 * renders a plain, honest "not configured yet" state instead of a Buy button
 * that would fail — the same pattern as the Google sign-in button.
 */
export function CheckoutPanel({
  listingId,
  price,
  paymentsEnabled,
  publishableKey,
}: {
  listingId: string;
  price: number;
  paymentsEnabled: boolean;
  publishableKey: string;
}) {
  const [state, action, pending] = useActionState(startPurchaseAction, idlePurchaseState);

  if (!paymentsEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline p-4 text-center">
        <p className="text-[13.5px] leading-relaxed text-muted">
          Payments aren&apos;t set up on this environment yet. Once Stripe keys are added, buyers pay
          here and the funds are held until an admin releases them.
        </p>
      </div>
    );
  }

  if (state.status === "ready") {
    return (
      <Elements
        stripe={getStripeClient(publishableKey)}
        options={{ clientSecret: state.clientSecret, appearance: { theme: "night" } }}
      >
        <PaymentForm total={state.total} transactionId={state.transactionId} />
      </Elements>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="listingId" value={listingId} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-ink px-5 py-3.5 text-[15px] font-bold text-base disabled:opacity-60"
      >
        {pending ? "Preparing checkout…" : `Buy for ${formatCad(price)}`}
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-center text-[13px] text-urgency">
          {state.error}
        </p>
      )}
    </form>
  );
}

function PaymentForm({ total, transactionId }: { total: number; transactionId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Analytics for the funnel step itself; purchase_initiated already fired
    // server-side when the PaymentIntent was created.
  }, [transactionId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Try again.");
      setSubmitting(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-hairline p-4 text-center">
        <p className="text-[15px] font-bold">Payment held</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {formatCad(total)} is now held by the platform. An admin reviews the handover and releases
          it to the seller — you&apos;ll be notified either way.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p role="alert" className="text-[13px] text-urgency">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded-full bg-ink px-5 py-3.5 text-[15px] font-bold text-base disabled:opacity-60"
      >
        {submitting ? "Processing…" : `Pay ${formatCad(total)}`}
      </button>
      <p className="text-center text-[11.5px] text-muted">
        Held by the platform until an admin confirms the handover — not sent to the seller yet.
      </p>
    </form>
  );
}
