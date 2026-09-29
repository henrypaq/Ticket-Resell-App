"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  declareSellerTicketSentAction,
  removeSellLeadAction,
} from "@/domains/beta-quick/actions";
import { sellerJourney, type SellerStage } from "@/domains/beta-quick/journey";
import type { GoActivityEntry, ProfilePrefillData } from "@/domains/beta-quick/shared";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import { AccountSetupEntry } from "./account-setup-entry";
import {
  CopyRow,
  FlyerHero,
  JourneyCard,
  JourneyProgress,
  JourneyScreen,
  LiveDots,
  QUIET_BUTTON_CLASS,
  useLiveRefresh,
} from "./journey";

/**
 * A seller's listing, start to payout, on one full-screen page. Custody events
 * (Café Campus) start with handing the ticket to us; every listing then goes
 * live, sells, and pays out. The bar at the top fills as it moves — the steps
 * are never spelled out as a list, each screen just says what's happening now.
 */
export function SellerJourneyScreen({
  entry,
  waitingBuyers,
  venueLine,
  custody,
  accountSetup = null,
}: {
  entry: GoActivityEntry;
  waitingBuyers: number;
  venueLine: string | null;
  custody: { name: string; email: string };
  /** Offered right after listing, when this visitor has no profile yet. */
  accountSetup?: { prefill: ProfilePrefillData; setupPath: string } | null;
}) {
  const router = useRouter();
  const { stage, step, requiresCustody } = sellerJourney(entry);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const refreshing = useLiveRefresh(
    stage === "checking" || stage === "live" || stage === "claimed" || stage === "sold",
    stage === "live" ? 20_000 : 8_000,
  );

  const each = entry.askEach != null ? `$${entry.askEach.toFixed(2)}` : null;
  const sold = entry.soldCount ?? 0;
  const payout = entry.askEach != null ? entry.askEach * Math.max(sold, 1) : null;
  const payoutLabel = payout != null ? `$${payout.toFixed(2)}` : "your payout";
  const canRemove = stage === "send" || stage === "checking" || stage === "live";

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

  const copy = stageCopy(stage, {
    each,
    payoutLabel,
    quantity: entry.quantity,
    waitingBuyers,
    // Only custody tickets are already with us; everyone else hands theirs
    // to the buyer we match them with (seller terms), coordinated by us.
    weHoldTicket: requiresCustody && Boolean(entry.ticketReceivedAt),
  });

  const errorLine = error && (
    <p role="alert" className="text-center text-[13px] text-urgency">
      {error}
    </p>
  );

  const footer = (
    <>
      {errorLine}
      {stage === "send" && (
        <button
          type="button"
          disabled={pending}
          className={BUTTON_CLASS}
          onClick={() => run(() => declareSellerTicketSentAction(entry.leadId))}
        >
          {pending ? "Saving…" : "I've sent it"}
        </button>
      )}
      {stage === "paid_out" && entry.payoutToConfirmOfferId && (
        <Link href={`/payout/confirm?offer=${entry.payoutToConfirmOfferId}`} className={BUTTON_CLASS}>
          Confirm it landed
        </Link>
      )}
      <Link href="/" className={QUIET_BUTTON_CLASS}>
        Home
      </Link>
      {canRemove &&
        (confirmRemove ? (
          <div className="flex items-center justify-center gap-4 py-1 text-[13px]">
            <span className="text-muted">Take this listing down?</span>
            <button
              type="button"
              disabled={pending}
              className="font-semibold text-urgency"
              onClick={() => run(() => removeSellLeadAction(entry.leadId), () => router.replace("/"))}
            >
              {pending ? "Removing…" : "Remove"}
            </button>
            <button type="button" className="font-semibold text-muted" onClick={() => setConfirmRemove(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="py-1 text-[12.5px] font-semibold text-muted underline decoration-dotted underline-offset-4"
            onClick={() => setConfirmRemove(true)}
          >
            Remove listing
          </button>
        ))}
    </>
  );

  return (
    <JourneyScreen footer={footer}>
      <FlyerHero
        flyerUrl={entry.flyerUrl}
        eyebrow={copy.eyebrow}
        title={entry.eventName}
        subtitle={venueLine}
      />
      <div className="px-5 pb-8 pt-4 sm:px-6">
        <JourneyProgress
          current={step}
          total={5}
          tone={stage === "sold" || stage === "paid_out" ? "emerald" : "brand"}
        />

        {copy.live && (
          <div className="mt-6">
            <LiveDots active={refreshing} label={copy.live} />
          </div>
        )}

        <h2 className="headline mt-3 text-[28px] leading-[1.12] tracking-tight text-ink sm:text-[30px]">
          {copy.title}
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{copy.body}</p>

        {stage === "send" && (
          <JourneyCard className="mt-6">
            <p className="section-header">Transfer your ticket to</p>
            <div className="mt-3 flex flex-col gap-2">
              <CopyRow label="Name" value={custody.name} />
              <CopyRow label="Email" value={custody.email} />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              If it doesn&apos;t sell, or you change your mind, we transfer it straight back to you.
            </p>
          </JourneyCard>
        )}

        <JourneyCard className="mt-6">
          <Row label="Tickets" value={`×${entry.quantity}`} />
          {each && <Row label="Price" value={`${each} each`} />}
          {sold > 0 && <Row label="Sold" value={`${sold} of ${entry.quantity}`} />}
          {(stage === "live" || stage === "send" || stage === "checking") && waitingBuyers > 0 && (
            <Row label="People waiting" value={String(waitingBuyers)} />
          )}
          {(stage === "sold" || stage === "paid_out") && payout != null && (
            <Row label="Your payout" value={`$${payout.toFixed(2)}`} />
          )}
        </JourneyCard>

        {accountSetup && (
          <AccountSetupEntry
            intent="sell"
            returnTo={`/listing/${entry.leadId}`}
            setupPath={accountSetup.setupPath}
            prefill={accountSetup.prefill}
            className="mt-8"
          />
        )}
      </div>
    </JourneyScreen>
  );
}

function stageCopy(
  stage: SellerStage,
  ctx: {
    each: string | null;
    payoutLabel: string;
    quantity: number;
    waitingBuyers: number;
    weHoldTicket: boolean;
  },
): { eyebrow: string; title: string; body: string; live?: string } {
  const it = ctx.quantity === 1 ? "it" : "them";
  const ticket = ctx.quantity === 1 ? "ticket" : "tickets";
  switch (stage) {
    case "send":
      return {
        eyebrow: "Almost live",
        title: `Send us your ${ticket}`,
        body: `Transfer ${it} to us so we can verify ${it} before buyers see your listing. It keeps everyone safe from tickets that were already used or resold.`,
      };
    case "checking":
      return {
        eyebrow: "Verifying",
        title: `We're checking your ${ticket}`,
        body: "Once we see it land and confirm it's valid, your listing goes live. You don't need to do anything else.",
        live: "Checking",
      };
    case "live":
      return {
        eyebrow: "Listed",
        title: `Your ${ticket} ${ctx.quantity === 1 ? "is" : "are"} live`,
        body:
          ctx.waitingBuyers > 0
            ? `We're offering ${it} to the people in line now. We'll message you the moment ${it} ${ctx.quantity === 1 ? "sells" : "sell"}.`
            : `We'll offer ${it} to the next buyer who joins the line and message you the moment ${it} ${ctx.quantity === 1 ? "sells" : "sell"}.`,
        live: "Live",
      };
    case "claimed":
      return {
        eyebrow: "Buyer found",
        title: "A buyer claimed your ticket",
        body: "They're sending payment now. Once it clears, your ticket is sold and your payout is on its way.",
        live: "Waiting on payment",
      };
    case "sold":
      return {
        eyebrow: "Sold",
        title: "Sold!",
        body: ctx.weHoldTicket
          ? `Payment cleared. We're sending the ticket to the buyer, then ${ctx.payoutLabel} to you by Interac.`
          : `Payment cleared. Keep your phone close — we'll message you with where to transfer the ticket. Once the buyer has it, ${ctx.payoutLabel} comes to you by Interac.`,
        live: "Payout on its way",
      };
    case "paid_out":
      return {
        eyebrow: "Paid out",
        title: "Your payout is sent",
        body: `We've sent ${ctx.payoutLabel} by Interac. Let us know once it lands so we can close this out.`,
      };
    case "closed":
      return {
        eyebrow: "Closed",
        title: "This listing is closed",
        body: "It's no longer listed. List it again from home anytime.",
      };
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 text-[13.5px]">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

export function SellerJourneyUnavailable() {
  return (
    <JourneyScreen
      footer={
        <Link href="/" className={QUIET_BUTTON_CLASS}>
          Home
        </Link>
      }
    >
      <div className="px-5 pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-6">
        <p className="font-ui text-[13px] font-semibold tracking-[0.04em] text-ink/55">
          mcgill.tickets
        </p>
        <h1 className="headline mt-10 text-[28px] leading-[1.15] tracking-tight text-ink">
          Listing not found
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          We couldn&apos;t find that listing on this device. Open home to see your tickets for sale.
        </p>
      </div>
    </JourneyScreen>
  );
}
