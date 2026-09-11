"use client";

import Link from "next/link";
import {
  formatBetaEventWhen,
  type BetaEvent,
  type BetaWeekday,
} from "@/lib/beta-events";
import type { QuickWaitlistEntry } from "@/domains/beta-quick/shared";
import { BUTTON_CLASS } from "@/components/beta-waitlist/field-styles";
import { QuickShell } from "./shell";

export function QuickHub({
  tonight,
  tonightDay,
  otherEvents,
  waitlist,
}: {
  tonight: BetaEvent[];
  tonightDay: BetaWeekday;
  otherEvents: BetaEvent[];
  waitlist: QuickWaitlistEntry[];
}) {
  const posters = tonight.length > 0 ? tonight : otherEvents.slice(0, 4);

  return (
    <QuickShell>
      <header className="relative">
        <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-4 text-[32px] leading-[1.12] tracking-tight sm:text-[36px]">
          DON&apos;T PANIC IF TICKETS ARE SOLD OUT
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Buy and sell sold-out tickets — fast. We handle the handoff.
        </p>
      </header>

      {waitlist.length > 0 && (
        <section className="relative mt-8">
          <p className="section-header text-[11px] text-muted">Your waitlist</p>
          <ul className="mt-3 flex flex-col gap-2">
            {waitlist.map((entry) => (
              <li
                key={entry.leadId}
                className="flex items-center justify-between gap-3 rounded-[16px] border-l-2 border-[#ffe500] bg-white/[0.05] px-4 py-3"
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

      <section className="relative mt-8">
        <p className="section-header text-[11px] text-muted">
          {tonight.length > 0 ? "Tonight" : "Upcoming"}
        </p>
        <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {posters.map((event) => (
            <EventPoster
              key={event.slug}
              event={event}
              day={tonight.length > 0 ? tonightDay : event.days[0]}
            />
          ))}
        </div>
        {tonight.length === 0 && (
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
          I have a ticket
        </Link>
      </section>
    </QuickShell>
  );
}

function EventPoster({ event, day }: { event: BetaEvent; day: BetaWeekday }) {
  return (
    <article className="relative w-[42vw] max-w-[180px] shrink-0 overflow-hidden rounded-[20px] bg-[#17171a]">
      <div className="relative aspect-[3/4] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={event.flyerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="headline text-[15px] leading-tight text-ink">{event.name}</p>
          <p className="mt-1 text-[11px] text-muted">{formatBetaEventWhen(day)}</p>
        </div>
      </div>
    </article>
  );
}
