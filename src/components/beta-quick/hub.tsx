"use client";

import { useState } from "react";
import Link from "next/link";
import {
  formatBetaEventWhen,
  type BetaEvent,
  type BetaWeekday,
} from "@/lib/beta-events";
import type { GoActivityEntry, QuickWaitlistEntry } from "@/domains/beta-quick/shared";
import { BUTTON_CLASS } from "@/components/beta-waitlist/field-styles";
import { ArrowLeft } from "@/components/icons";
import { QuickShell } from "./shell";

export function QuickHub({
  tonight,
  tonightDay,
  otherEvents,
  waitlist,
  activity,
}: {
  tonight: BetaEvent[];
  tonightDay: BetaWeekday;
  otherEvents: BetaEvent[];
  waitlist: QuickWaitlistEntry[];
  activity: GoActivityEntry[];
}) {
  const [selected, setSelected] = useState<{ event: BetaEvent; day: BetaWeekday } | null>(null);
  const hasTonight = tonight.length > 0;
  const posters = hasTonight ? tonight : otherEvents.slice(0, 4);

  if (selected) {
    return (
      <QuickShell>
        <EventIntentView
          event={selected.event}
          day={selected.day}
          onBack={() => setSelected(null)}
        />
      </QuickShell>
    );
  }

  const sellActivity = activity.filter((a) => a.intent === "sell");
  const doneSells = sellActivity.filter((a) => a.status === "done");
  const totalProceeds = doneSells.reduce((sum, a) => sum + (a.proceedsCad ?? 0), 0);
  const totalNet = doneSells.reduce((sum, a) => sum + (a.netVsPaidCad ?? 0), 0);

  return (
    <QuickShell>
      <header className="relative">
        <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-4 text-[32px] leading-[1.12] tracking-tight sm:text-[36px]">
          DON&apos;T PANIC IF TICKETS ARE SOLD OUT
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Buy and sell sold-out tickets fast. Secure matching between buyers and sellers, we
          refund you in case of issues.
        </p>
      </header>

      {waitlist.length > 0 && (
        <section className="relative mt-8">
          <p className="section-header text-[11px] text-muted">Your waitlist</p>
          <ul className="mt-4 flex flex-col gap-4">
            {waitlist.map((entry) => (
              <li
                key={entry.leadId}
                className="flex items-center justify-between gap-3 rounded-[16px] bg-[#17171a] px-4 py-3.5 shadow-[0_7px_0_0_#c9b400,0_12px_28px_rgba(255,229,0,0.14)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">{entry.eventName}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    ×{entry.quantity}
                    {entry.status === "matched"
                      ? " · matched — we’ll message you"
                      : entry.status === "done"
                        ? " · completed"
                        : " · we’ll message you when a ticket opens"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[20px] font-bold tabular-nums text-[#ffe500]">#{entry.position}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted">in line</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sellActivity.length > 0 && (
        <section className="relative mt-8">
          <p className="section-header text-[11px] text-muted">Your tickets for sale</p>
          <ul className="mt-3 flex flex-col gap-2">
            {sellActivity.map((entry) => (
              <li
                key={entry.leadId}
                className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold text-ink">{entry.eventName}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      ×{entry.quantity}
                      {entry.askEach != null ? ` · $${entry.askEach.toFixed(0)} each` : ""}
                      {entry.status === "done"
                        ? " · sold"
                        : entry.status === "matched"
                          ? " · matched"
                          : " · listed"}
                    </p>
                  </div>
                  {entry.status === "done" && entry.proceedsCad != null && (
                    <p className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink">
                      ${entry.proceedsCad.toFixed(0)}
                      {entry.netVsPaidCad != null && entry.netVsPaidCad !== 0 && (
                        <span className="mt-0.5 block text-[11px] font-medium text-muted">
                          {entry.netVsPaidCad > 0 ? "+" : ""}
                          ${entry.netVsPaidCad.toFixed(0)} vs paid
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {doneSells.length > 0 && (
            <p className="mt-3 text-[12.5px] text-muted">
              Sold so far: ${totalProceeds.toFixed(0)} received
              {totalNet !== 0
                ? ` (${totalNet > 0 ? "+" : ""}$${totalNet.toFixed(0)} vs what you paid)`
                : ""}
              .
            </p>
          )}
        </section>
      )}

      <section className="relative mt-8">
        <p className="section-header text-[11px] text-muted">
          {hasTonight ? `Tonight · ${formatBetaEventWhen(tonightDay)}` : "Upcoming"}
        </p>
        {/* py so the selection ring isn’t clipped by overflow-x */}
        <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {posters.map((event) => (
            <EventPoster
              key={event.slug}
              event={event}
              day={hasTonight ? tonightDay : event.days[0]!}
              onSelect={() => setSelected({ event, day: hasTonight ? tonightDay : event.days[0]! })}
            />
          ))}
        </div>
        {!hasTonight && (
          <p className="mt-3 text-[13px] text-muted">
            Nothing listed for tonight — more nights once you pick buy or sell.
          </p>
        )}
      </section>

      <section className="relative mt-10 flex flex-col gap-3">
        <p className="section-header text-[11px] text-muted">What do you need?</p>
        <Link href="/go/buy" className={`${BUTTON_CLASS} min-h-[64px] text-[17px]`}>
          I need a ticket
        </Link>
        <Link
          href="/go/sell"
          className="flex min-h-[64px] items-center justify-center rounded-[14px] border border-white/20 bg-white/[0.06] px-8 text-[17px] font-bold text-ink transition-colors hover:bg-white/[0.1]"
        >
          I have a ticket to sell
        </Link>
      </section>
    </QuickShell>
  );
}

function EventIntentView({
  event,
  day,
  onBack,
}: {
  event: BetaEvent;
  day: BetaWeekday;
  onBack: () => void;
}) {
  const buyHref = `/go/buy?event=${encodeURIComponent(event.slug)}`;
  const sellHref = `/go/sell?event=${encodeURIComponent(event.slug)}`;

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
          <p className="mt-2 text-[15px] text-muted">{formatBetaEventWhen(day)}</p>
          {event.entryNote && (
            <p className="mt-2 text-[13px] font-semibold text-[#ffe500]">{event.entryNote}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="section-header text-[11px] text-muted">What do you need?</p>
        <Link href={buyHref} className={`${BUTTON_CLASS} min-h-[56px] text-[16px]`}>
          I need a ticket
        </Link>
        <Link
          href={sellHref}
          className="flex min-h-[56px] items-center justify-center rounded-[14px] border border-white/20 bg-white/[0.06] px-8 text-[16px] font-bold text-ink transition-colors hover:bg-white/[0.1]"
        >
          I have a ticket to sell
        </Link>
      </div>
    </div>
  );
}

function EventPoster({
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
          <p className="mt-1 text-[11px] text-muted">{formatBetaEventWhen(day)}</p>
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
