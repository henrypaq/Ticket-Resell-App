"use client";

import Link from "next/link";
import { formatBetaEventWhenShort, type BetaEvent, type BetaWeekday } from "@/lib/beta-events";
import { ArrowLeft } from "@/components/icons";
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

  return (
    <div className="relative flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 self-start text-[13.5px] font-semibold text-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex gap-4">
        <div className="relative h-[120px] w-[90px] shrink-0 overflow-hidden rounded-[16px] bg-[#17171a] ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.flyerUrl} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="headline text-[28px] leading-[1.12] tracking-tight">{event.name}</h1>
          <p className="mt-2 text-[15px] text-muted">{formatBetaEventWhenShort(day)}</p>
          {event.entryNote && (
            <p className="mt-2 text-[13px] font-semibold text-[#ffe500]">{event.entryNote}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="section-header">What do you need?</p>
        <Link href={buyHref} className={`${BUTTON_CLASS} min-h-[56px] text-[16px]`}>
          I need a ticket
        </Link>
        <Link href={sellHref} className={`${STARRY_SELL_BUTTON_CLASS} min-h-[56px]`}>
          <StarryButtonStars />
          <span className="relative z-10">I have a ticket to sell</span>
        </Link>
      </div>

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
  );
}

/** Poster in the home page's horizontal "tonight" rail. */
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
      className="relative w-[42vw] max-w-[180px] shrink-0 rounded-[20px] bg-[#17171a] outline-none ring-2 ring-transparent transition-[box-shadow,transform,ring-color] hover:ring-[#ffe500]/55 focus-visible:ring-[#ffe500] active:scale-[0.98] active:ring-[#ffe500]"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[20px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={event.flyerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-3 text-left">
          <p className="headline text-[15px] leading-tight text-ink">{event.name}</p>
          <p className="mt-1 text-[11px] text-muted">{formatBetaEventWhenShort(day)}</p>
          {event.entryNote && (
            <p className="mt-1 text-[10.5px] font-semibold leading-snug text-[#ffe500]">
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
            <p className="mt-1.5 text-[10.5px] font-semibold leading-snug text-[#ffe500]">
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
