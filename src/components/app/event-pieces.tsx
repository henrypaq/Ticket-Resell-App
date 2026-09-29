"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadBuyAvailabilityAction } from "@/domains/beta-quick/actions";
import { formatBetaEventWhenShort, type BetaEvent, type BetaWeekday } from "@/lib/beta-events";
import { FlyerHero, JourneyScreen } from "./journey";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import {
  STARRY_SELL_BUTTON_CLASS,
  StarryButtonStars,
} from "@/components/forms/starry-button";
import { SERVICE_FEE_CAD, SERVICE_FEE_LABEL } from "@/lib/compliance/fees";
import { formatCad } from "@/lib/format";

export { SECONDARY_BUTTON_CLASS } from "@/components/forms/field-styles";
/**
 * The one place the two intents are offered. Home and /upcoming both route an
 * event tap here rather than each having their own buy/sell affordance — the
 * old apps had three variants of this between them (`/go` hub, `/member`
 * events tab, event detail) and they drifted apart.
 */
export function EventIntentView({
  event,
  day,
  onBack,
}: {
  event: BetaEvent;
  day: BetaWeekday;
  onBack: () => void;
}) {
  const buyHref = `/buy?event=${encodeURIComponent(event.slug)}`;
  const sellHref = `/sell?event=${encodeURIComponent(event.slug)}`;
  const [availability, setAvailability] = useState<{
    availableUnits: number;
    demandAhead: number;
    canCheckoutNow: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadBuyAvailabilityAction(event.slug, 1).then((result) => {
      if (!cancelled && result) setAvailability(result);
    });
    return () => {
      cancelled = true;
    };
  }, [event.slug]);

  const showBlurb =
    event.blurb &&
    event.blurb.trim().toLowerCase() !== `${event.name} at ${event.venue}`.toLowerCase();

  return (
    <JourneyScreen
      footer={
        <>
          <Link href={buyHref} className={`${BUTTON_CLASS} w-full`}>
            I need a ticket
          </Link>
          <Link href={sellHref} className={`${STARRY_SELL_BUTTON_CLASS} min-h-[52px]`}>
            <StarryButtonStars />
            <span className="relative z-10">I have a ticket to sell</span>
          </Link>
        </>
      }
    >
      <FlyerHero
        flyerUrl={event.flyerUrl}
        onBack={onBack}
        eyebrow={formatBetaEventWhenShort(day)}
        title={event.name}
        subtitle={`${event.venue} · ${event.city}`}
        size="lg"
      />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2 sm:px-6">
        {event.entryNote && (
          <p className="text-[13.5px] font-semibold text-brand">{event.entryNote}</p>
        )}
        {showBlurb && <p className="text-[14.5px] leading-relaxed text-muted">{event.blurb}</p>}

        <div className="grid grid-cols-2 gap-2.5">
          <Stat
            label="Listed now"
            value={availability ? String(availability.availableUnits) : "–"}
            highlight={Boolean(availability?.canCheckoutNow)}
          />
          <Stat
            label="People waiting"
            value={availability ? String(availability.demandAhead) : "–"}
          />
        </div>
        <p className="-mt-2 text-[13px] leading-relaxed text-muted">
          {!availability
            ? "Checking what's available…"
            : availability.canCheckoutNow
              ? "A ticket looks available right now — the first buyer to finish gets an exclusive hold."
              : availability.availableUnits > 0
                ? "Tickets are listed, but others are in line first. Join and we'll hold one for you when it's your turn."
                : "Nothing listed yet. Join the line and we'll message you the moment a ticket is held for you."}
        </p>

        {/*
          Fee disclosure, carried over from the retired member event detail —
          the label comes from SERVICE_FEE_LABEL and is never written inline
          (CLAUDE.md rule 2).
        */}
        <p className="border-t border-hairline pt-4 text-[12.5px] text-muted">
          {SERVICE_FEE_LABEL}: {formatCad(SERVICE_FEE_CAD)} per ticket — collected when we confirm
          your handoff.
        </p>
      </div>
    </JourneyScreen>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3.5 ${
        highlight ? "bg-brand/[0.08] ring-1 ring-brand/30" : "bg-white/[0.04]"
      }`}
    >
      <p className={`font-ui text-[26px] font-bold tabular-nums tracking-tight ${highlight ? "text-brand" : "text-ink"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
    </div>
  );
}

/** Poster in the home page's horizontal "tonight" rail — sized to fit one screen. */
export function EventPoster({
  event,
  day,
  onSelect,
}: {
  event: BetaEvent;
  day: BetaWeekday;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${event.name} — choose buy or sell`}
      className="relative w-[34vw] max-w-[132px] shrink-0 rounded-[16px] bg-[#17171a] outline-none ring-2 ring-transparent transition-[box-shadow,transform,ring-color] hover:ring-brand/55 focus-visible:ring-brand active:scale-[0.98] active:ring-brand"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[16px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={event.flyerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-2 text-left">
          <p className="headline text-[12.5px] leading-tight text-ink">{event.name}</p>
          <p className="mt-0.5 text-[10px] text-muted">{formatBetaEventWhenShort(day)}</p>
          {event.entryNote && (
            <p className="mt-0.5 text-[9.5px] font-semibold leading-snug text-brand">
              {event.entryNote}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

/** Numbered poster in the /upcoming grid. */
export function EventPosterCard({
  event,
  index,
  onClick,
}: {
  event: BetaEvent;
  index: number;
  onClick: () => void;
}) {
  return (
    <div className="relative pb-4">
      <button
        type="button"
        onClick={onClick}
        aria-label={`${event.name} — choose buy or sell`}
        className="group relative block aspect-[3/4] w-full overflow-hidden rounded-[22px] text-left ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 hover:ring-white/20 active:scale-[0.98]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={event.flyerUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/90 via-black/30 to-transparent"
        />
        <div className="absolute inset-x-0 top-0 p-3.5">
          <h2 className="headline text-[16px] leading-[1.15] text-ink">{event.name}</h2>
          {event.entryNote && (
            <p className="mt-1.5 text-[10.5px] font-semibold leading-snug text-brand">
              {event.entryNote}
            </p>
          )}
        </div>
      </button>
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-1 left-0 z-10 select-none text-[64px] font-bold leading-none tracking-tight text-ink"
        style={{
          textShadow:
            "0 1px 0 rgba(0,0,0,0.9), 0 -1px 0 rgba(0,0,0,0.9), 1px 0 0 rgba(0,0,0,0.9), -1px 0 0 rgba(0,0,0,0.9), 0 6px 18px rgba(0,0,0,0.45)",
        }}
      >
        {index}
      </span>
    </div>
  );
}
