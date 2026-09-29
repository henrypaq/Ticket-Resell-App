"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { sellerConfirmPayoutAction } from "@/domains/beta-matching/seller-actions";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import { FlyerHero, JourneyCard, JourneyProgress, JourneyScreen, QUIET_BUTTON_CLASS } from "./journey";

/**
 * Last beat of the seller journey: confirm the Interac payout landed. Reached
 * from the payout email and from the listing page's "Confirm it landed".
 */
export function PayoutConfirmPanel({
  offerId,
  eventName,
  flyerUrl,
  amount,
  alreadyConfirmed,
  payoutReleased,
}: {
  offerId: string;
  eventName: string;
  flyerUrl: string | null;
  amount: number;
  alreadyConfirmed: boolean;
  payoutReleased: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyConfirmed);
  const amountLabel = `$${amount.toFixed(2)}`;

  const homeLink = (
    <Link href="/" className={done || !payoutReleased ? BUTTON_CLASS : QUIET_BUTTON_CLASS}>
      Home
    </Link>
  );

  if (!payoutReleased) {
    return (
      <JourneyScreen footer={homeLink}>
        <FlyerHero flyerUrl={flyerUrl} eyebrow="Payout" title={eventName} />
        <div className="px-5 pb-8 pt-4 sm:px-6">
          <JourneyProgress current={4} total={5} tone="emerald" />
          <h2 className="headline mt-6 text-[28px] leading-[1.12] tracking-tight text-ink">
            Your payout isn&apos;t out yet
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            We haven&apos;t sent the Interac for this sale yet. We&apos;ll email you the moment it
            goes out — your listing on home shows where things are.
          </p>
        </div>
      </JourneyScreen>
    );
  }

  return (
    <JourneyScreen
      footer={
        <>
          {error && (
            <p role="alert" className="text-center text-[13px] text-urgency">
              {error}
            </p>
          )}
          {!done && (
            <button
              type="button"
              disabled={pending}
              className={BUTTON_CLASS}
              onClick={() => {
                setError(null);
                start(async () => {
                  const result = await sellerConfirmPayoutAction(offerId);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setDone(true);
                  router.refresh();
                });
              }}
            >
              {pending ? "Saving…" : "I received the money"}
            </button>
          )}
          {homeLink}
        </>
      }
    >
      <FlyerHero flyerUrl={flyerUrl} eyebrow={done ? "All done" : "Payout sent"} title={eventName} />
      <div className="px-5 pb-8 pt-4 sm:px-6">
        <JourneyProgress current={5} total={5} tone="emerald" />
        <h2 className="headline mt-6 text-[28px] leading-[1.12] tracking-tight text-ink">
          {done ? "You're paid" : "Did the money land?"}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {done
            ? `Thanks — that's the sale closed out. Nice work.`
            : "We've sent your Interac payout. Tap below once it's in your account so we can close out the sale."}
        </p>
        <JourneyCard className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] text-muted">Payout</span>
            <span className="font-ui text-[22px] font-bold tabular-nums tracking-tight text-emerald-300">
              {amountLabel}
            </span>
          </div>
        </JourneyCard>
      </div>
    </JourneyScreen>
  );
}
