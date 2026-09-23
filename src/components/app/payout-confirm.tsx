"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { sellerConfirmPayoutAction } from "@/domains/beta-matching/seller-actions";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import { AppFlowShell } from "./shell";

export function PayoutConfirmPanel({
  offerId,
  eventName,
  amount,
  alreadyConfirmed,
  payoutReleased,
}: {
  offerId: string;
  eventName: string;
  amount: number;
  alreadyConfirmed: boolean;
  payoutReleased: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyConfirmed);

  if (!payoutReleased) {
    return (
      <AppFlowShell>
        <div className="mx-auto max-w-md py-10">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Payout not sent yet
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
            We haven’t marked an Interac payout for this sale. If you expected
            one, reply to your listing email or check back from home.
          </p>
          <Link href="/" className={`${BUTTON_CLASS} mt-8 inline-flex`}>
            Back home
          </Link>
        </div>
      </AppFlowShell>
    );
  }

  return (
    <AppFlowShell>
      <div className="mx-auto max-w-md py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          {done ? "Payout confirmed" : "Did the money land?"}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
          {done
            ? `Thanks — we recorded that you received $${amount.toFixed(2)} for ${eventName}.`
            : `Confirm when you’ve received the Interac payout of $${amount.toFixed(2)} for ${eventName}. This updates our ops board so we can close the sale.`}
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {!done ? (
          <button
            type="button"
            disabled={pending}
            className={`${BUTTON_CLASS} mt-8 w-full`}
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
        ) : (
          <Link href="/" className={`${BUTTON_CLASS} mt-8 inline-flex`}>
            Back home
          </Link>
        )}
      </div>
    </AppFlowShell>
  );
}
