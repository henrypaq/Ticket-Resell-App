"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  buyerAcceptOfferAction,
  buyerDeclineOfferAction,
} from "@/domains/beta-matching/buyer-actions";
import { AppFlowShell } from "@/components/app/shell";
import { BUTTON_CLASS } from "@/components/forms/field-styles";

export function OfferClaimPanel({
  offerId,
  eventName,
  priceEach,
  status,
  expiresAt,
  paymentDueAt,
}: {
  offerId: string;
  eventName: string;
  priceEach: number;
  status: string;
  expiresAt: string;
  paymentDueAt: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const deadlineIso = status === "accepted" && paymentDueAt ? paymentDueAt : expiresAt;
  const remainingMs = Math.max(0, new Date(deadlineIso).getTime() - now);
  const mins = Math.floor(remainingMs / 60_000);
  const secs = Math.floor((remainingMs % 60_000) / 1000);
  const live = status === "offered" || status === "accepted";

  return (
    <AppFlowShell>
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
        Ticket offer
      </p>
      <h1 className="headline mt-2 text-[28px] leading-tight tracking-tight">{eventName}</h1>
      <p className="mt-3 text-[15px] text-ink">
        ${priceEach.toFixed(2)} · status: <span className="font-semibold">{status}</span>
      </p>

      {live && (
        <p className="mt-4 rounded-2xl border border-hairline bg-card px-4 py-3 text-[14px] text-ink">
          {status === "accepted" ? "Payment due in" : "Respond in"}{" "}
          <span className="font-semibold tabular-nums">
            {mins}:{String(secs).padStart(2, "0")}
          </span>
        </p>
      )}

      {status === "offered" && (
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={pending || remainingMs === 0}
            className={BUTTON_CLASS}
            onClick={() => {
              setError(null);
              start(async () => {
                const r = await buyerAcceptOfferAction(offerId);
                if (r.error) setError(r.error);
                else {
                  setMessage(r.message ?? "Accepted.");
                  router.refresh();
                }
              });
            }}
          >
            {pending ? "…" : "I'll take it"}
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-full border border-hairline px-4 py-3 text-[14px] font-semibold text-muted"
            onClick={() => {
              setError(null);
              start(async () => {
                const r = await buyerDeclineOfferAction(offerId, "price");
                if (r.error) setError(r.error);
                else {
                  setMessage(r.message ?? "Passed.");
                  router.refresh();
                }
              });
            }}
          >
            Pass on this price
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-full px-4 py-3 text-[13px] font-semibold text-muted underline decoration-dotted"
            onClick={() => {
              setError(null);
              start(async () => {
                const r = await buyerDeclineOfferAction(offerId, "not_going");
                if (r.error) setError(r.error);
                else {
                  setMessage(r.message ?? "Left waitlist.");
                  router.refresh();
                }
              });
            }}
          >
            Not going anymore
          </button>
        </div>
      )}

      {status === "accepted" && (
        <p className="mt-6 text-[14px] leading-relaxed text-muted">
          Send the Interac e-transfer now. Ops will confirm payment and transfer the ticket. If the
          payment window ends first, this hold expires and the next person in line gets it.
        </p>
      )}

      {!live && (
        <p className="mt-6 text-[14px] text-muted">
          This offer is closed ({status}). You&apos;re still on the waitlist unless you left.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-[13.5px] text-urgency">
          {error}
        </p>
      )}
      {message && <p className="mt-4 text-[13.5px] text-ink">{message}</p>}
    </AppFlowShell>
  );
}
