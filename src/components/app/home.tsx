"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BETA_SOCIALS,
  formatBetaEventWhenShort,
  isPastNightlife,
  type BetaEvent,
  type BetaWeekday,
} from "@/lib/beta-events";
import { dismissPastSellLeadsAction } from "@/domains/beta-quick/actions";
import {
  buyerJourney,
  isWalletStage,
  sellerHasSale,
  sellerJourney,
  type BuyerJourney,
  type SellerStage,
} from "@/domains/beta-quick/journey";
import type { GoActivityEntry, QuickWaitlistEntry } from "@/domains/beta-quick/shared";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import {
  STARRY_SELL_BUTTON_CLASS,
  StarryButtonStars,
} from "@/components/forms/starry-button";
import { ChevronRight, InstagramIcon, SnapchatIcon } from "@/components/icons";
import { EventIntentView, EventPoster } from "./event-pieces";
import { FixedPriceEventScreen } from "./fixed-price-event";
import { EventRequestSection } from "./event-request";
import { TicketStubCard, type StubTone } from "./journey";
import { isPredeterminedQueueEntry } from "./queue";

/**
 * Home. Deliberately shows tonight only — the whole board lives behind
 * "See all" on `/upcoming`. The old `/member` events tab opened with every
 * upcoming night at once, which buried the two things people actually come
 * here to do.
 */
export function AppHome({
  tonight,
  tonightDay,
  waitlist,
  activity,
  listedBySlug = {},
}: {
  tonight: BetaEvent[];
  tonightDay: BetaWeekday;
  waitlist: QuickWaitlistEntry[];
  activity: GoActivityEntry[];
  /** Tickets listed for tonight, by event slug. Earlier nights are not included. */
  listedBySlug?: Record<string, number>;
}) {
  const [selected, setSelected] = useState<{ event: BetaEvent; day: BetaWeekday } | null>(null);
  const hasTonight = tonight.length > 0;

  if (selected) {
    if (selected.event.fixedPriceEach != null) {
      return (
        <FixedPriceEventScreen
          event={selected.event}
          day={selected.day}
          onBack={() => setSelected(null)}
        />
      );
    }
    return (
      <EventIntentView
        event={selected.event}
        day={selected.day}
        onBack={() => setSelected(null)}
      />
    );
  }

  const sellActivity = activity.filter((a) => a.intent === "sell");
  // A listing with a buyer on it is never "unsold", however old it is —
  // sweeping it into the past-unsold notice would offer to cancel a sale.
  const sellCards = sellActivity
    .map((entry) => ({ entry, journey: sellerJourney(entry) }))
    .filter(({ entry, journey }) => {
      if (journey.stage === "closed") return false;
      if (journey.stage === "paid_out") return Boolean(entry.payoutToConfirmOfferId);
      return sellerHasSale(entry) || !isPastNightlife(entry.createdAt);
    });
  const pastUnsoldSells = sellActivity.filter(
    (a) =>
      a.status !== "done" &&
      a.status !== "cancelled" &&
      isPastNightlife(a.createdAt) &&
      !sellerHasSale(a),
  );
  const doneSells = sellActivity.filter((a) => a.status === "done");
  const totalProceeds = doneSells.reduce((sum, a) => sum + (a.proceedsCad ?? 0), 0);
  const totalNet = doneSells.reduce((sum, a) => sum + (a.netVsPaidCad ?? 0), 0);
  const buyJourneys = waitlist.map((entry) => ({ entry, journey: buyerJourney(entry) }));
  const walletTickets = buyJourneys.filter(({ journey }) => isWalletStage(journey.stage));
  const openWaitlist = buyJourneys
    .filter(
      ({ entry, journey }) =>
        (journey.stage === "waiting" || journey.stage === "queue") && entry.onTonight !== false,
    )
    .map(({ entry }) => entry);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="relative shrink-0 pt-1">
        <h1 className="headline text-[26px] leading-[1.1] tracking-tight sm:text-[30px]">
          DON&apos;T PANIC IF TICKETS ARE SOLD OUT
        </h1>
        <p className="mt-2 max-w-[34ch] text-[13.5px] leading-snug text-muted">
          Buy and sell sold-out tickets fast. Secure matching between buyers and sellers — we
          refund you if something goes wrong.
        </p>
      </header>

      <div className="relative mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {walletTickets.length > 0 && (
          <section className="relative shrink-0">
            <p className="section-header text-emerald-400/80">
              {walletTickets.length === 1 ? "Your ticket" : "Your tickets"}
            </p>
            <ul className={WALLET_RAIL_CLASS}>
              {walletTickets.map(({ entry, journey }) => (
                <li key={entry.leadId} className="shrink-0">
                  <BuyerTicketCard entry={entry} journey={journey} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {openWaitlist.length > 0 && (
          <section className="relative shrink-0">
            <p className="section-header">Your waitlist</p>
            <ul className="mt-2.5 flex flex-col gap-2">
              {openWaitlist.map((entry) => (
                <li key={entry.leadId} className="flex flex-col gap-2">
                  {/* Every seat opens its live waitlist page, where it can also be edited. */}
                  <Link
                    href={`/queue?lead=${entry.leadId}&event=${encodeURIComponent(entry.eventSlug)}`}
                    className="flex w-full items-center gap-3.5 rounded-[16px] bg-card px-3.5 py-3 text-left transition-colors hover:bg-[#1c1c20] active:bg-[#1c1c20]"
                  >
                    <WaitlistPositionBadge position={entry.position} />
                    <div className="min-w-0 flex-1">
                      <p className="font-ui truncate text-[15px] font-semibold tracking-tight text-ink">
                        {isPredeterminedQueueEntry(entry)
                          ? `Your place in line · #${entry.position}`
                          : `Waitlist position #${entry.position}`}
                      </p>
                      <p className="mt-0.5 truncate text-[12.5px] leading-snug text-muted">
                        {entry.eventName}
                        {" · "}
                        {entry.quantity === 1 ? "1 ticket" : `${entry.quantity} tickets`}
                        {isPredeterminedQueueEntry(entry) && entry.buyerDeclaredSentAt
                          ? " · Interac sent — in queue"
                          : null}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted/70" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(sellCards.length > 0 || pastUnsoldSells.length > 0 || doneSells.length > 0) && (
          <section className="relative shrink-0">
            {sellCards.length > 0 && (
              <>
                <p className="section-header">Your tickets for sale</p>
                <ul className={WALLET_RAIL_CLASS}>
                  {sellCards.map(({ entry, journey }) => (
                    <li key={entry.leadId} className="shrink-0">
                      <SellerTicketCard entry={entry} stage={journey.stage} />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {pastUnsoldSells.length > 0 && (
              <div className={sellCards.length > 0 ? "mt-3" : ""}>
                <PastUnsoldSellNotice pastUnsoldSells={pastUnsoldSells} />
              </div>
            )}

            {doneSells.length > 0 && (
              <p className="mt-2 text-[12.5px] text-muted">
                Sold so far: ${totalProceeds.toFixed(0)} received
                {totalNet !== 0
                  ? ` (${totalNet > 0 ? "+" : ""}$${totalNet.toFixed(0)} vs what you paid)`
                  : ""}
                .
              </p>
            )}
          </section>
        )}

        <section className="relative flex shrink-0 flex-col gap-2">
          <p className="section-header">What do you need?</p>
          <Link href="/buy" className={`${BUTTON_CLASS} min-h-[52px] text-[15px]`}>
            I need a ticket
          </Link>
          <Link href="/sell" className={`${STARRY_SELL_BUTTON_CLASS} min-h-[52px] text-[15px]`}>
            <StarryButtonStars />
            <span className="relative z-10">I have a ticket to sell</span>
          </Link>
        </section>

        <section className="relative min-h-0 shrink">
          <div className="flex items-baseline justify-between gap-3">
            <p className="section-header">
              {hasTonight ? `Tonight · ${formatBetaEventWhenShort(tonightDay)}` : "Tonight"}
            </p>
            <Link
              href="/upcoming"
              className="font-ui inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold text-brand transition-opacity hover:opacity-80"
            >
              See all events
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {hasTonight ? (
            <div className="-mx-5 mt-2 flex gap-2.5 overflow-x-auto px-5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6">
              {tonight.map((event) => (
                <EventPoster
                  key={event.slug}
                  event={event}
                  day={tonightDay}
                  listedCount={listedBySlug[event.slug] ?? 0}
                  onSelect={() => setSelected({ event, day: tonightDay })}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Nothing running tonight.{" "}
              <Link
                href="/upcoming"
                className="font-semibold text-ink underline decoration-dotted underline-offset-4"
              >
                See what&apos;s coming up
              </Link>
              .
            </p>
          )}
        </section>
      </div>

      {/* iOS-style bottom chrome — request + socials on one row */}
      <footer className="relative mt-3 flex shrink-0 items-center gap-3 border-t border-white/[0.06] pt-3">
        <div className="min-w-0 flex-1">
          <EventRequestSection compact />
        </div>
        <div className="flex shrink-0 items-center gap-2.5 pr-0.5">
          <a
            href={BETA_SOCIALS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="transition-transform hover:scale-105"
          >
            <InstagramIcon className="h-6 w-6" />
          </a>
          <a
            href={BETA_SOCIALS.snapchat}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Snapchat"
            className="transition-transform hover:scale-105"
          >
            <SnapchatIcon className="h-6 w-6" />
          </a>
        </div>
      </footer>
    </div>
  );
}

const WALLET_RAIL_CLASS =
  "-mx-5 mt-2 flex gap-2.5 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6";

function ticketCount(n: number): string {
  return n === 1 ? "1 ticket" : `${n} tickets`;
}

/** One purchase in the home wallet — the card's look follows the journey stage. */
function BuyerTicketCard({ entry, journey }: { entry: QuickWaitlistEntry; journey: BuyerJourney }) {
  const price = journey.offer ? `$${journey.offer.priceEach.toFixed(0)}` : null;
  const card: { status: string; detail: string; cta: string; tone: StubTone } =
    journey.stage === "held"
      ? { status: "Held for you", detail: `${price} · answer before it expires`, cta: "Claim ticket", tone: "brand" }
      : journey.stage === "pay"
        ? { status: "Pay now", detail: `${price} · send your Interac`, cta: "Pay", tone: "brand" }
        : journey.stage === "payment_sent"
          ? { status: "Payment sent", detail: "We're matching your Interac", cta: "View", tone: "sky" }
          : journey.stage === "review"
            ? { status: "Under review", detail: "We're checking your payment", cta: "View", tone: "sky" }
            : journey.stage === "confirmed"
              ? { status: "Confirmed", detail: `${ticketCount(entry.quantity)} · on its way`, cta: "View ticket", tone: "sky" }
              : {
                  status: "Transferred",
                  detail: entry.transferEmail
                    ? `${ticketCount(entry.quantity)} · ${entry.transferEmail}`
                    : ticketCount(entry.quantity),
                  cta: "View ticket",
                  tone: "emerald",
                };
  return (
    <TicketStubCard
      href={journey.href}
      flyerUrl={entry.flyerUrl}
      title={entry.eventName}
      {...card}
    />
  );
}

/** One listing in the home "for sale" rail; opens the seller journey. */
function SellerTicketCard({ entry, stage }: { entry: GoActivityEntry; stage: SellerStage }) {
  const each = entry.askEach != null ? `$${entry.askEach.toFixed(0)} each` : "";
  const qty = `×${entry.quantity}${each ? ` · ${each}` : ""}`;
  const card: { status: string; detail: string; cta: string; tone: StubTone } =
    stage === "send"
      ? { status: "Send ticket", detail: "Send it to us to go live", cta: "Send ticket", tone: "brand" }
      : stage === "checking"
        ? { status: "Checking", detail: "We're verifying your ticket", cta: "View", tone: "sky" }
        : stage === "claimed"
          ? { status: "Buyer paying", detail: qty, cta: "View", tone: "sky" }
          : stage === "sold"
            ? { status: "Sold", detail: "Your payout is on its way", cta: "View", tone: "emerald" }
            : stage === "paid_out"
              ? { status: "Paid out", detail: "Confirm the money landed", cta: "Confirm", tone: "emerald" }
              : { status: "Live", detail: qty, cta: "View listing", tone: "neutral" };
  return (
    <TicketStubCard
      href={`/listing/${entry.leadId}`}
      flyerUrl={entry.flyerUrl}
      title={entry.eventName}
      {...card}
    />
  );
}

/** Compact position indicator — the number is the visual anchor. */
function WaitlistPositionBadge({
  position,
  highlight = false,
  size = "md",
}: {
  position: number;
  highlight?: boolean;
  size?: "md" | "lg";
}) {
  const dim =
    size === "lg"
      ? "h-[80px] min-w-[80px] rounded-[18px] px-3"
      : "h-[56px] min-w-[56px] rounded-[14px] px-2.5";
  const num =
    size === "lg"
      ? "text-[30px] leading-none"
      : "text-[20px] leading-none";
  return (
    <div
      className={`font-ui flex shrink-0 flex-col items-center justify-center ${dim} ${
        highlight
          ? "bg-brand text-black"
          : "border border-white/20 bg-transparent text-brand"
      }`}
      aria-label={`Position ${position} in waitlist`}
    >
      <span className={`${num} font-bold tabular-nums tracking-tight`}>
        {position}
      </span>
      {size === "lg" && (
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
          in line
        </span>
      )}
    </div>
  );
}

function PastUnsoldSellNotice({
  pastUnsoldSells,
}: {
  pastUnsoldSells: GoActivityEntry[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dismissPending, startDismiss] = useTransition();

  if (dismissed || pastUnsoldSells.length === 0) return null;

  const totalTickets = pastUnsoldSells.reduce((sum, s) => sum + s.quantity, 0);
  const uniqueEvents = [...new Set(pastUnsoldSells.map((s) => s.eventName))];
  const eventsLabel = uniqueEvents.join(", ");

  function handleDismiss() {
    setDismissed(true);
    startDismiss(async () => {
      const ids = pastUnsoldSells.map((s) => s.leadId);
      await dismissPastSellLeadsAction(ids);
      router.refresh();
    });
  }

  if (!expanded) {
    return (
      <div
        className="flex w-full items-center gap-2 rounded-[16px] border border-[#6ee1ff]/35 bg-[#6ee1ff]/[0.06] p-3.5"
        role="status"
      >
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-label="Notice: Unsold tickets from last night — tap to view details"
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-90 active:scale-[0.99]"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6ee1ff]/20 text-[15px] font-black text-[#6ee1ff]"
          >
            !
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">
              Notice: Unsold tickets from last night
            </p>
            <p className="truncate text-[12px] text-muted">
              {eventsLabel} ({totalTickets} {totalTickets === 1 ? "ticket" : "tickets"})
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={dismissPending}
            className="rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#6ee1ff] transition-colors hover:bg-[#6ee1ff]/10 disabled:opacity-50"
          >
            {dismissPending ? "…" : "Got it"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="pr-0.5 text-[12.5px] font-semibold text-[#6ee1ff]/80 hover:text-[#6ee1ff]"
          >
            View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Unsold tickets notice"
      className="rounded-[16px] border border-[#6ee1ff]/35 bg-[#6ee1ff]/[0.06] p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6ee1ff]/20 text-[14px] font-black text-[#6ee1ff]"
          >
            !
          </span>
          <h3 className="text-[15px] font-bold leading-snug text-ink sm:text-[16px]">
            There weren&apos;t enough buyers for your tickets last night!
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="shrink-0 rounded-full p-1 text-[13px] text-muted transition-colors hover:text-ink"
          aria-label="Collapse message"
        >
          ✕
        </button>
      </div>

      <div className="mt-3.5 space-y-1.5 rounded-[12px] border border-white/10 bg-transparent p-3 text-[13px]">
        {pastUnsoldSells.map((entry) => (
          <div key={entry.leadId} className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink">{entry.eventName}</span>
            <span className="tabular-nums text-muted">
              ×{entry.quantity}
              {entry.askEach != null ? ` · $${entry.askEach.toFixed(0)} each` : ""}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        We&apos;re sorry we couldn&apos;t find a buyer for your {eventsLabel} ticket
        {totalTickets > 1 ? "s" : ""} before the night wrapped up. Demand moves fast in Montreal
        nightlife, and last night the buyer queue ran out before your listing was reached.
      </p>

      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        We know it sucks when an extra ticket goes unused — we&apos;re constantly growing the buyer
        network so more tickets find homes. Thanks for listing with us! Next time you have an extra,
        post early and we&apos;ll do our best to match you.
      </p>

      <div className="mt-4 flex items-center justify-end gap-3 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[13px] font-semibold text-muted transition-colors hover:text-ink"
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissPending}
          className="rounded-[10px] border border-[#6ee1ff]/40 bg-[#6ee1ff]/15 px-4 py-2 text-[13px] font-semibold text-[#6ee1ff] transition-colors hover:bg-[#6ee1ff]/25 disabled:opacity-50"
        >
          {dismissPending ? "Removing…" : "Got it"}
        </button>
      </div>
    </div>
  );
}
