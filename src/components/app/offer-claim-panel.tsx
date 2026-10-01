"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  buyerAcceptOfferAction,
  buyerDeclarePaymentSentAction,
  buyerDeclineOfferAction,
} from "@/domains/beta-matching/buyer-actions";
import { confirmTicketReceivedAction } from "@/domains/beta-quick/actions";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import {
  CONFIRM_TOGGLE_CLASS,
  CONFIRM_TOGGLE_ON_CLASS,
  CopyRow,
  CountdownDisplay,
  FlyerHero,
  JourneyCard,
  JourneyProgress,
  JourneyScreen,
  LiveDots,
  QUIET_BUTTON_CLASS,
  useCountdown,
  useLiveRefresh,
} from "./journey";

type EtransferInfo = {
  name: string;
  email: string;
  phone: string | null;
  configured: boolean;
};

type Stage =
  | "claim"
  | "pay"
  | "sent"
  | "review"
  | "confirmed"
  | "transferred"
  | "closed";

/** Journey bar position per stage — five beats from "held" to "in your inbox". */
const STEP: Record<Exclude<Stage, "closed">, number> = {
  claim: 1,
  pay: 2,
  sent: 3,
  review: 3,
  confirmed: 4,
  transferred: 5,
};

/**
 * The marketplace buyer's journey for one held ticket, full-screen like the
 * fixed-price flow: hold → pay → we match the Interac → ticket on its way →
 * transferred. Every closed outcome gets its own words and a way forward.
 */
export function OfferClaimPanel({
  offerId,
  eventName,
  eventSlug,
  flyerUrl,
  venueLine,
  priceEach,
  status,
  declineReason,
  expiresAt,
  paymentDueAt,
  buyerDeclaredSentAt,
  ticketTransferredAt,
  buyLeadId,
  transferEmail,
  receivedConfirmedAt,
  paymentMemo,
  etransfer,
  isOwner,
}: {
  offerId: string;
  eventName: string;
  eventSlug: string;
  flyerUrl: string | null;
  venueLine: string | null;
  priceEach: number;
  status: string;
  declineReason: string | null;
  expiresAt: string;
  paymentDueAt: string | null;
  buyerDeclaredSentAt: string | null;
  ticketTransferredAt: string | null;
  buyLeadId: string | null;
  transferEmail: string | null;
  receivedConfirmedAt: string | null;
  paymentMemo: string;
  etransfer: EtransferInfo;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentToggle, setSentToggle] = useState(false);

  const stage: Stage =
    status === "paid"
      ? ticketTransferredAt
        ? "transferred"
        : "confirmed"
      : status === "needs_review"
        ? "review"
        : status === "accepted" && buyerDeclaredSentAt
          ? "sent"
          : status === "accepted"
            ? "pay"
            : status === "offered"
              ? "claim"
              : "closed";

  const deadlineIso = stage === "pay" && paymentDueAt ? paymentDueAt : expiresAt;
  const remaining = useCountdown(
    stage === "claim" || stage === "pay" ? Date.parse(deadlineIso) : null,
  );
  const refreshing = useLiveRefresh(
    isOwner && (stage === "sent" || stage === "review" || stage === "confirmed" || stage === "claim"),
  );

  function run(action: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const r = await action();
      if (r.error) {
        setError(r.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  const price = `$${priceEach.toFixed(2)}`;
  const hero = (eyebrow: string) => (
    <FlyerHero flyerUrl={flyerUrl} eyebrow={eyebrow} title={eventName} subtitle={venueLine} />
  );
  const errorLine = error && (
    <p role="alert" className="text-center text-[13px] text-urgency">
      {error}
    </p>
  );
  const homeLink = (
    <Link href="/" className={QUIET_BUTTON_CLASS}>
      Home
    </Link>
  );

  if (!isOwner) {
    return (
      <JourneyScreen footer={homeLink}>
        {hero("Ticket offer")}
        <Body>
          <Headline>Open this on your phone</Headline>
          <Lead>
            Open this link from the device you used to join the waitlist so we can show your
            payment details.
          </Lead>
        </Body>
      </JourneyScreen>
    );
  }

  if (stage === "closed") {
    const copy = closedCopy(status, declineReason);
    return (
      <JourneyScreen
        footer={
          <>
            {copy.rejoin && (
              <Link href={`/buy?event=${encodeURIComponent(eventSlug)}`} className={BUTTON_CLASS}>
                Join the waitlist again
              </Link>
            )}
            {copy.contact && (
              <Link href="/settings" className={copy.rejoin ? QUIET_BUTTON_CLASS : BUTTON_CLASS}>
                Message us
              </Link>
            )}
            {homeLink}
          </>
        }
      >
        {hero("Ticket offer")}
        <Body>
          <p className="section-header">{copy.eyebrow}</p>
          <Headline>{copy.title}</Headline>
          <Lead>{copy.body}</Lead>
        </Body>
      </JourneyScreen>
    );
  }

  const progress = (
    <JourneyProgress
      current={STEP[stage]}
      total={5}
      tone={stage === "transferred" ? "emerald" : "brand"}
    />
  );

  if (stage === "claim") {
    const expired = remaining <= 0;
    return (
      <JourneyScreen
        footer={
          <>
            {errorLine}
            <button
              type="button"
              disabled={pending || expired}
              className={BUTTON_CLASS}
              onClick={() => run(() => buyerAcceptOfferAction(offerId))}
            >
              {pending ? "…" : `I'll take it · ${price}`}
            </button>
            <button
              type="button"
              disabled={pending}
              className={QUIET_BUTTON_CLASS}
              onClick={() => run(() => buyerDeclineOfferAction(offerId, "price"))}
            >
              Pass on this price
            </button>
            <button
              type="button"
              disabled={pending}
              className="py-1 text-[12.5px] font-semibold text-muted underline decoration-dotted underline-offset-4"
              onClick={() => run(() => buyerDeclineOfferAction(offerId, "not_going"))}
            >
              I&apos;m not going anymore
            </button>
          </>
        }
      >
        {hero("A ticket is held for you")}
        <Body>
          {progress}
          <div className="mt-6 flex items-baseline justify-between gap-3">
            <Headline className="mt-0">It&apos;s yours if you want it</Headline>
            <p className="font-ui shrink-0 text-[26px] font-bold tabular-nums tracking-tight text-brand">
              {price}
            </p>
          </div>
          <Lead>
            If you don&apos;t accept before the timer runs out, it goes to the next person.
          </Lead>
          <div className="mt-6">
            <CountdownDisplay
              remainingMs={remaining}
              caption="To respond"
              expiredCaption="Hold expired"
            />
          </div>
        </Body>
      </JourneyScreen>
    );
  }

  if (stage === "pay") {
    return (
      <JourneyScreen
        footer={
          <>
            {errorLine}
            <button
              type="button"
              aria-pressed={sentToggle}
              onClick={() => setSentToggle((v) => !v)}
              disabled={!etransfer.configured}
              className={sentToggle ? CONFIRM_TOGGLE_ON_CLASS : CONFIRM_TOGGLE_CLASS}
            >
              {sentToggle ? "E-transfer sent ✓" : "I've sent the e-transfer"}
            </button>
            <button
              type="button"
              disabled={pending || !sentToggle || !etransfer.configured}
              className={BUTTON_CLASS}
              onClick={() => run(() => buyerDeclarePaymentSentAction(offerId))}
            >
              {pending ? "Saving…" : "Confirm payment sent"}
            </button>
          </>
        }
      >
        {hero("Send payment")}
        <Body>
          {progress}
          <Headline>Send {price} by Interac</Headline>
          <Lead>
            You pay mcgill.tickets, never another student directly. We hold your money until the
            ticket is in your hands.
          </Lead>

          <JourneyCard className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-muted">Time left to send</p>
              <p className="font-ui text-[20px] font-bold tabular-nums tracking-tight text-brand">
                {remaining > 0 ? formatShort(remaining) : "—"}
              </p>
            </div>
          </JourneyCard>

          {etransfer.configured ? (
            <JourneyCard className="mt-3">
              <p className="section-header">Interac e-Transfer</p>
              <div className="mt-3 flex flex-col gap-2">
                <CopyRow label="Amount" value={priceEach.toFixed(2)} />
                <CopyRow label="Send to" value={etransfer.email} />
                <CopyRow label="Name" value={etransfer.name} />
                {etransfer.phone && <CopyRow label="Or phone" value={etransfer.phone} />}
                <CopyRow label="Message / memo" value={paymentMemo} mono />
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Use the memo exactly — it links your transfer to this ticket.
              </p>
            </JourneyCard>
          ) : (
            <JourneyCard className="mt-3 text-[13.5px] text-muted">
              Payment details aren&apos;t set up yet. Message us and we&apos;ll send the Interac
              address.
            </JourneyCard>
          )}

          <p className="mt-4 text-[12px] leading-relaxed text-muted">
            If cleared funds don&apos;t reach us within 2 hours of your confirmation, the hold is
            cancelled and anything that did arrive is refunded.
          </p>
        </Body>
      </JourneyScreen>
    );
  }

  if (stage === "sent" || stage === "review") {
    return (
      <JourneyScreen footer={homeLink}>
        {hero(stage === "review" ? "Payment under review" : "Payment sent")}
        <Body>
          {progress}
          <div className="mt-6">
            <LiveDots active={refreshing} label="Checking" />
          </div>
          <Headline>
            {stage === "review" ? "We're taking a closer look" : "We're matching your Interac"}
          </Headline>
          <Lead>
            {stage === "review"
              ? "Something about the transfer needs a human check. Your ticket stays held for you while we sort it out — we'll message you either way."
              : "Your money is with mcgill.tickets, not the seller. As soon as we match it, your ticket is on its way. You can close this page."}
          </Lead>
          <JourneyCard className="mt-6">
            <Row label="Amount" value={`${price} CAD`} />
            <Row label="Memo" value={paymentMemo} mono />
          </JourneyCard>
        </Body>
      </JourneyScreen>
    );
  }

  if (stage === "confirmed") {
    return (
      <JourneyScreen footer={homeLink}>
        {hero("Purchase confirmed")}
        <Body>
          {progress}
          <div className="mt-6">
            <LiveDots active={refreshing} />
          </div>
          <Headline>Your ticket is on its way</Headline>
          <Lead>
            Payment confirmed. Your ticket is being transferred
            {transferEmail ? (
              <>
                {" "}
                to <span className="text-ink/90">{transferEmail}</span>
              </>
            ) : null}{" "}
            — this page updates the moment it&apos;s sent.
          </Lead>
          <JourneyCard className="mt-6">
            <p className="section-header">Receipt</p>
            <div className="mt-3 flex flex-col gap-2">
              <Row label="Event" value={eventName} />
              <Row label="Paid" value={`${price} CAD`} />
              <Row label="Reference" value={paymentMemo} mono />
            </div>
          </JourneyCard>
        </Body>
      </JourneyScreen>
    );
  }

  // transferred
  const canConfirm = Boolean(buyLeadId) && !receivedConfirmedAt;
  return (
    <JourneyScreen
      footer={
        <>
          {errorLine}
          {canConfirm && (
            <button
              type="button"
              disabled={pending}
              className={BUTTON_CLASS}
              onClick={() =>
                run(
                  () => confirmTicketReceivedAction(buyLeadId!),
                  () => router.replace("/"),
                )
              }
            >
              {pending ? "Saving…" : "I got my ticket"}
            </button>
          )}
          {homeLink}
        </>
      }
    >
      {hero("You're all set")}
      <Body>
        {progress}
        <p className="section-header mt-6 text-emerald-400">Transferred</p>
        <Headline>Your ticket has been transferred</Headline>
        <Lead>
          Check{" "}
          {transferEmail ? (
            <span className="font-medium text-ink">{transferEmail}</span>
          ) : (
            "the email we have on file"
          )}{" "}
          for your ticket. Look in spam if you don&apos;t see it within a few minutes.
        </Lead>
        <JourneyCard className="mt-6">
          <Row label="Event" value={eventName} />
          <Row label="Paid" value={`${price} CAD`} />
          <Row label="Reference" value={paymentMemo} mono />
        </JourneyCard>
      </Body>
    </JourneyScreen>
  );
}

function closedCopy(
  status: string,
  declineReason: string | null,
): { eyebrow: string; title: string; body: string; rejoin: boolean; contact: boolean } {
  switch (status) {
    case "declined":
      return declineReason === "not_going"
        ? {
            eyebrow: "Offer closed",
            title: "You've left this waitlist",
            body: "No problem — the ticket went to the next person in line. If plans change, you can join again anytime.",
            rejoin: true,
            contact: false,
          }
        : {
            eyebrow: "Offer passed",
            title: "You passed on this one",
            body: "You're still in line. We'll offer you the next ticket that comes up.",
            rejoin: false,
            contact: false,
          };
    case "expired_no_response":
      return {
        eyebrow: "Hold expired",
        title: "This hold ran out",
        body: "We didn't hear back in time, so the ticket moved to the next person in line. You'll get the next one that comes up.",
        rejoin: false,
        contact: false,
      };
    case "expired_unpaid":
      return {
        eyebrow: "Hold expired",
        title: "Payment didn't arrive in time",
        body: "The ticket went to the next person in line. If you did send money, message us and we'll refund it.",
        rejoin: true,
        contact: true,
      };
    case "payment_failed":
      return {
        eyebrow: "Payment issue",
        title: "We couldn't match your payment",
        body: "Anything that reached us will be refunded. Message us if you have questions — we reply fast.",
        rejoin: true,
        contact: true,
      };
    case "withdrawn":
      return {
        eyebrow: "Offer closed",
        title: "This ticket is no longer available",
        body: "The seller pulled it before the sale went through. You keep your place in line for the next one.",
        rejoin: false,
        contact: false,
      };
    default:
      return {
        eyebrow: "Offer closed",
        title: "This offer has closed",
        body: "You're still on the waitlist unless you left it.",
        rejoin: false,
        contact: false,
      };
  }
}

function formatShort(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  }
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="px-5 pb-8 pt-4 sm:px-6">{children}</div>;
}

function Headline({ children, className = "mt-3" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`headline text-[28px] leading-[1.12] tracking-tight text-ink sm:text-[30px] ${className}`}>
      {children}
    </h2>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-muted">{children}</p>;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 text-[13.5px]">
      <span className="text-muted">{label}</span>
      <span className={`text-right font-semibold text-ink ${mono ? "font-mono text-[12.5px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
