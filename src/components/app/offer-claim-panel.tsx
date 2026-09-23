"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  buyerAcceptOfferAction,
  buyerDeclarePaymentSentAction,
  buyerDeclineOfferAction,
} from "@/domains/beta-matching/buyer-actions";
import { AppFlowShell } from "@/components/app/shell";
import { BUTTON_CLASS } from "@/components/forms/field-styles";

type EtransferInfo = {
  name: string;
  email: string;
  phone: string | null;
  configured: boolean;
};

export function OfferClaimPanel({
  offerId,
  eventName,
  priceEach,
  status,
  expiresAt,
  paymentDueAt,
  buyerDeclaredSentAt,
  paymentMemo,
  etransfer,
  isOwner,
}: {
  offerId: string;
  eventName: string;
  priceEach: number;
  status: string;
  expiresAt: string;
  paymentDueAt: string | null;
  buyerDeclaredSentAt: string | null;
  paymentMemo: string;
  etransfer: EtransferInfo;
  isOwner: boolean;
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

  const stage =
    status === "paid"
      ? "receipt"
      : status === "accepted" && buyerDeclaredSentAt
        ? "held"
        : status === "accepted"
          ? "pay"
          : status === "offered"
            ? "claim"
            : "closed";

  if (!isOwner) {
    return (
      <AppFlowShell>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          Ticket offer
        </p>
        <h1 className="headline mt-2 text-[28px] leading-tight tracking-tight">{eventName}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Open this link from the device you used to join the waitlist so we can show your payment
          details.
        </p>
        <Link href="/" className={`${BUTTON_CLASS} mt-8 w-full`}>
          Back to home
        </Link>
      </AppFlowShell>
    );
  }

  return (
    <AppFlowShell>
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
        {stage === "receipt"
          ? "Purchase confirmed"
          : stage === "held"
            ? "Payment held"
            : stage === "pay"
              ? "Send payment"
              : "Ticket offer"}
      </p>
      <h1 className="headline mt-2 text-[28px] leading-tight tracking-tight">{eventName}</h1>

      {stage === "claim" && (
        <>
          <p className="mt-3 text-[15px] text-ink">
            <span className="font-semibold">${priceEach.toFixed(2)}</span> held for you
          </p>
          <p className="mt-4 rounded-2xl border border-hairline bg-card px-4 py-3 text-[14px] text-ink">
            Respond in{" "}
            <span className="font-semibold tabular-nums text-[#ffe500]">
              {mins}:{String(secs).padStart(2, "0")}
            </span>
          </p>
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
                  else router.refresh();
                });
              }}
            >
              {pending ? "…" : "I'll take it — show payment"}
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
        </>
      )}

      {stage === "pay" && (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Send payment to mcgill.tickets now. We hold your money until the ticket is transferred —
            you&apos;re never sending funds directly to another student.
          </p>
          <p className="mt-4 rounded-2xl border border-hairline bg-card px-4 py-3 text-[14px] text-ink">
            Send before{" "}
            <span className="font-semibold tabular-nums text-[#ffe500]">
              {mins}:{String(secs).padStart(2, "0")}
            </span>{" "}
            or this hold goes to the next person in line.
          </p>

          <PayDetails
            priceEach={priceEach}
            paymentMemo={paymentMemo}
            etransfer={etransfer}
          />

          <p className="mt-4 rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 text-[12.5px] leading-relaxed text-muted">
            Please use Interac Autodeposit or complete the transfer promptly. If we haven&apos;t
            received cleared funds within 2 hours of your confirmation, we cancel the hold and
            refund any amount that did arrive — so the next buyer isn&apos;t blocked and your money
            stays protected.
          </p>

          <button
            type="button"
            disabled={pending || !etransfer.configured}
            className={`${BUTTON_CLASS} mt-6 w-full`}
            onClick={() => {
              setError(null);
              start(async () => {
                const r = await buyerDeclarePaymentSentAction(offerId);
                if (r.error) setError(r.error);
                else router.refresh();
              });
            }}
          >
            {pending ? "…" : "I've sent the money"}
          </button>
        </>
      )}

      {stage === "held" && (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Your money is with mcgill.tickets — not the seller yet. We hold it until the ticket is
            transferred.
          </p>
          <div className="mt-6 rounded-2xl border border-hairline bg-card px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
              Payment held
            </p>
            <p className="mt-2 text-[22px] font-semibold tabular-nums text-ink">
              ${priceEach.toFixed(2)} CAD
            </p>
            <ol className="mt-4 flex flex-col gap-3 text-[13.5px] leading-relaxed text-muted">
              <li>
                <span className="font-semibold text-ink">1. We confirm your Interac</span>
                <span className="mt-0.5 block">Ops matches your transfer using memo {paymentMemo}.</span>
              </li>
              <li>
                <span className="font-semibold text-ink">2. Seller transfers the ticket</span>
                <span className="mt-0.5 block">
                  They have 30 minutes after we confirm. If it doesn&apos;t arrive, you get a full
                  refund.
                </span>
              </li>
              <li>
                <span className="font-semibold text-ink">3. You&apos;re done</span>
                <span className="mt-0.5 block">
                  We message you when the ticket is on the way. Nobody else can buy this seat while
                  it&apos;s yours.
                </span>
              </li>
            </ol>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            You don&apos;t need to do anything else right now. Keep this page or check home for
            status.
          </p>
          <Link href="/" className={`${BUTTON_CLASS} mt-8 w-full`}>
            Back to home
          </Link>
        </>
      )}

      {stage === "receipt" && (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Payment confirmed. We&apos;ll transfer the ticket shortly — keep an eye on your messages.
          </p>
          <div className="mt-6 rounded-2xl border border-hairline bg-card px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
              Receipt
            </p>
            <p className="mt-3 text-[15px] font-semibold text-ink">{eventName}</p>
            <dl className="mt-4 flex flex-col gap-2 text-[13.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Amount</dt>
                <dd className="font-semibold tabular-nums text-ink">${priceEach.toFixed(2)} CAD</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Reference</dt>
                <dd className="font-mono text-[12px] text-ink">{paymentMemo}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd className="font-semibold text-ink">Paid · transfer pending</dd>
              </div>
            </dl>
          </div>
          <Link href="/" className={`${BUTTON_CLASS} mt-8 w-full`}>
            Back to home
          </Link>
        </>
      )}

      {stage === "closed" && (
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

function PayDetails({
  priceEach,
  paymentMemo,
  etransfer,
  compact = false,
}: {
  priceEach: number;
  paymentMemo: string;
  etransfer: EtransferInfo;
  compact?: boolean;
}) {
  if (!etransfer.configured) {
    return (
      <p className="mt-6 rounded-2xl border border-hairline px-4 py-3 text-[13.5px] text-muted">
        Payment details aren&apos;t configured yet. Message us and we&apos;ll send the Interac
        address.
      </p>
    );
  }

  return (
    <div
      className={
        compact
          ? "mt-4 rounded-2xl border border-dashed border-hairline px-4 py-3 text-[13px] text-muted"
          : "mt-6 rounded-2xl border border-hairline bg-card px-4 py-4"
      }
    >
      {!compact && (
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
          Interac e-Transfer
        </p>
      )}
      <dl className={`flex flex-col gap-2.5 text-[14px] ${compact ? "" : "mt-3"}`}>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Amount</dt>
          <dd className="font-semibold tabular-nums text-ink">${priceEach.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Send to</dt>
          <dd className="text-right font-semibold text-ink">{etransfer.email}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Name</dt>
          <dd className="text-right text-ink">{etransfer.name}</dd>
        </div>
        {etransfer.phone && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Or phone</dt>
            <dd className="text-right text-ink">{etransfer.phone}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Message / memo</dt>
          <dd className="font-mono text-[12px] text-ink">{paymentMemo}</dd>
        </div>
      </dl>
      {!compact && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          Use the memo exactly — it links your transfer to this ticket. Autodeposit may not ask for
          a security question.
        </p>
      )}
    </div>
  );
}
