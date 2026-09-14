"use client";

import { useState } from "react";
import {
  betaDaySectionLabel,
  groupEventsByUpcomingDays,
  supportedBetaEvents,
  type BetaEvent,
  type BetaWeekday,
} from "@/lib/beta-events";
import { EventIntentView, EventPosterCard } from "./event-pieces";
import { EventRequestSection } from "./event-request";

/**
 * Everything on the board, one section per upcoming night — the "See all"
 * destination from home. A venue that runs several nights appears once under
 * each of them, because the night is what you're buying for.
 *
 * Tapping an event lands on the same buy/sell choice as home. The old member
 * events tab had a second, softer "join waitlist (alerts)" toggle here; both
 * it and a buy lead are seats in the same queue (`listUnifiedQueueSeats`), so
 * offering two ways to take the same seat only ever confused people about
 * which one held their spot.
 */
export function AppUpcoming() {
  const [selected, setSelected] = useState<{ event: BetaEvent; day: BetaWeekday } | null>(null);

  if (selected) {
    return (
      <EventIntentView
        event={selected.event}
        day={selected.day}
        onBack={() => setSelected(null)}
      />
    );
  }

  const groups = groupEventsByUpcomingDays(supportedBetaEvents());

  return (
    <>
      <header className="relative pt-3">
        <h1 className="headline text-[30px] leading-[1.12] tracking-tight">Upcoming events</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Every night we currently support. Pick one to buy or sell a ticket.
        </p>
      </header>

      <div className="relative mt-9 flex flex-col gap-9">
        {groups.length === 0 && (
          <p className="text-[14px] leading-relaxed text-muted">
            Nothing on the board right now. Request an event below and we&apos;ll work on it.
          </p>
        )}

        {groups.map(([day, events], index) => (
          <section key={day} className={index > 0 ? "border-t border-white/10 pt-9" : undefined}>
            <p className="section-header mb-5 text-[13px] tracking-[0.08em] text-ink">
              {betaDaySectionLabel(day)}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {events.map((event, eventIndex) => (
                <EventPosterCard
                  key={`${event.slug}-${day}`}
                  event={event}
                  index={eventIndex + 1}
                  onClick={() => setSelected({ event, day })}
                />
              ))}
            </div>
          </section>
        ))}

        <EventRequestSection />
      </div>
    </>
  );
}
