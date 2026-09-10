"use client";

import { useState, useTransition } from "react";
import {
  setBetaEventInterestAction,
  submitBetaEventRequestAction,
  type BetaActionState,
} from "@/domains/beta-signup/actions";
import type { BetaSignupProfile } from "@/domains/beta-signup/shared";
import {
  BETA_WEEKDAYS,
  betaDaySectionLabel,
  betaEventBySlug,
  formatBetaEventWhen,
  supportedBetaEvents,
  type BetaEvent,
  type BetaWeekday,
} from "@/lib/beta-events";
import { SERVICE_FEE_CAD, SERVICE_FEE_LABEL } from "@/lib/compliance/fees";
import { formatCad } from "@/lib/format";
import { ArrowLeft, CheckIcon } from "@/components/icons";
import { Field } from "./field";
import { BUTTON_CLASS, FIELD_CLASS } from "./field-styles";

type Props = {
  profile: BetaSignupProfile | null;
};

/**
 * Events tab — supported venues, per-event waitlist/sell interest (saved for
 * later SMS/email hooks), request-an-event, and the flat service-fee note.
 * No payment processing here; ops handles that manually during the beta.
 */
export function BetaEventsTab({ profile }: Props) {
  const [view, setView] = useState<"list" | "detail" | "request">("list");
  const [selected, setSelected] = useState<BetaEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<BetaWeekday | null>(null);
  const [interests, setInterests] = useState(profile?.interests ?? []);
  const [flash, setFlash] = useState<string | null>(null);

  function openEvent(event: BetaEvent, day: BetaWeekday) {
    setSelected(event);
    setSelectedDay(day);
    setView("detail");
    setFlash(null);
  }

  function hasInterest(slug: string, intent: "waitlist" | "sell") {
    return interests.some((i) => i.eventSlug === slug && i.intent === intent);
  }

  function onInterestChanged(slug: string, intent: "waitlist" | "sell", active: boolean) {
    setInterests((prev) => {
      const without = prev.filter((i) => !(i.eventSlug === slug && i.intent === intent));
      return active ? [...without, { eventSlug: slug, intent }] : without;
    });
  }

  if (view === "request") {
    return (
      <RequestEventView
        onBack={() => {
          setView("list");
          setFlash(null);
        }}
        onDone={(message) => {
          setView("list");
          setFlash(message);
        }}
      />
    );
  }

  if (view === "detail" && selected && selectedDay) {
    return (
      <EventDetailView
        event={selected}
        day={selectedDay}
        waitlisted={hasInterest(selected.slug, "waitlist")}
        selling={hasInterest(selected.slug, "sell")}
        canSave={Boolean(profile)}
        onBack={() => {
          setView("list");
          setFlash(null);
        }}
        onInterestChanged={onInterestChanged}
        onFlash={setFlash}
      />
    );
  }

  const live = supportedBetaEvents();
  const groups = groupBySingleDay(live);
  const waitlistEvents = uniqueWaitlistEvents(interests, live);

  return (
    <div className="flex flex-col gap-9">
      {flash && (
        <p
          role="status"
          className="rounded-2xl border border-[#6ee1ff]/25 bg-[#6ee1ff]/10 px-4 py-3 text-[13.5px] text-ink"
        >
          {flash}
        </p>
      )}

      <MyWaitlistSection
        events={waitlistEvents}
        onOpen={(event, day) => openEvent(event, day)}
      />

      {groups.map(([day, events], index) => (
        <section key={day} className={index > 0 || waitlistEvents.length > 0 ? "border-t border-white/10 pt-9" : undefined}>
          <p className="section-header mb-5 text-[13px] tracking-[0.08em] text-ink">
            {betaDaySectionLabel(day)}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {events.map((event, eventIndex) => (
              <EventPosterCard
                key={`${event.slug}-${day}`}
                event={event}
                index={eventIndex + 1}
                waitlisted={hasInterest(event.slug, "waitlist")}
                onClick={() => openEvent(event, day)}
              />
            ))}
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={() => {
          setView("request");
          setFlash(null);
        }}
        className="pill-quiet flex min-h-[48px] w-full items-center justify-center px-4 text-[14px] font-semibold"
      >
        Request an event
      </button>
    </div>
  );
}

function MyWaitlistSection({
  events,
  onOpen,
}: {
  events: BetaEvent[];
  onOpen: (event: BetaEvent, day: BetaWeekday) => void;
}) {
  return (
    <section>
      <p className="section-header mb-3 text-[12px] tracking-[0.08em] text-muted">My waitlist</p>
      {events.length === 0 ? (
        <p className="text-[13.5px] leading-relaxed text-muted">
          Events you join the waiting list for will show up here.
        </p>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {events.map((event) => {
            const day = preferredWaitlistDay(event);
            return (
              <button
                key={event.slug}
                type="button"
                onClick={() => onOpen(event, day)}
                className="relative h-[118px] w-[96px] shrink-0 overflow-hidden rounded-[18px] ring-1 ring-white/12"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.flyerUrl} alt="" className="h-full w-full object-cover" />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/25 to-transparent"
                />
                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
                  <span className="headline text-left text-[11px] leading-tight text-ink">
                    {event.name}
                  </span>
                  <span className="shrink-0 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink ring-1 ring-white/15">
                    {weekdayAbbrev(day)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EventPosterCard({
  event,
  index,
  waitlisted,
  onClick,
}: {
  event: BetaEvent;
  index: number;
  waitlisted: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative pb-4">
      <button
        type="button"
        onClick={onClick}
        className="group relative block aspect-[3/4] w-full overflow-hidden rounded-[22px] text-left ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 hover:ring-white/20 active:scale-[0.98]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={event.flyerUrl}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/90 via-black/30 to-transparent"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3.5">
          <h2 className="headline text-[16px] leading-[1.15] text-ink">{event.name}</h2>
          {waitlisted && (
            <span className="shrink-0 rounded-full bg-[#ffe500] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
              Waitlist
            </span>
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

function weekdayAbbrev(day: BetaWeekday): string {
  return day.slice(0, 3).toUpperCase();
}

/** Prefer today if the event runs today; otherwise the soonest listed day. */
function preferredWaitlistDay(event: BetaEvent, from: Date = new Date()): BetaWeekday {
  const todayName = (
    ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
  )[from.getDay()] as BetaWeekday;
  if (event.days.includes(todayName)) return todayName;
  for (const day of BETA_WEEKDAYS) {
    if (event.days.includes(day)) return day;
  }
  return event.days[0] ?? "Thursday";
}

function uniqueWaitlistEvents(
  interests: { eventSlug: string; intent: "waitlist" | "sell" }[],
  live: BetaEvent[],
): BetaEvent[] {
  const waitlisted = new Set(
    interests.filter((i) => i.intent === "waitlist").map((i) => i.eventSlug),
  );
  const fromLive = live.filter((e) => waitlisted.has(e.slug));
  const known = new Set(fromLive.map((e) => e.slug));
  // Include waitlisted slugs that aren't on the live board (e.g. older picks).
  for (const slug of waitlisted) {
    if (known.has(slug)) continue;
    const found = betaEventBySlug(slug);
    if (found) fromLive.push(found);
  }
  return fromLive;
}

/** One weekday header at a time; multi-day events appear under each of their days. */
function groupBySingleDay(events: BetaEvent[]): [BetaWeekday, BetaEvent[]][] {
  const byDay = new Map<BetaWeekday, BetaEvent[]>();
  for (const day of BETA_WEEKDAYS) byDay.set(day, []);

  for (const event of events) {
    for (const day of event.days) {
      byDay.get(day)!.push(event);
    }
  }

  return BETA_WEEKDAYS.filter((day) => (byDay.get(day)?.length ?? 0) > 0).map((day) => [
    day,
    byDay.get(day)!,
  ]);
}

function EventDetailView({
  event,
  day,
  waitlisted,
  selling,
  canSave,
  onBack,
  onInterestChanged,
  onFlash,
}: {
  event: BetaEvent;
  day: BetaWeekday;
  waitlisted: boolean;
  selling: boolean;
  canSave: boolean;
  onBack: () => void;
  onInterestChanged: (slug: string, intent: "waitlist" | "sell", active: boolean) => void;
  onFlash: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(intent: "waitlist" | "sell", currentlyActive: boolean) {
    if (!canSave) {
      setError("Rejoin the waitlist so we can save your preferences.");
      return;
    }
    setError(null);
    const next = !currentlyActive;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("eventSlug", event.slug);
      fd.set("intent", intent);
      fd.set("active", next ? "1" : "0");
      const result: BetaActionState = await setBetaEventInterestAction({}, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      onInterestChanged(event.slug, intent, next);
      onFlash(result.message ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 self-start text-[13.5px] font-semibold text-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        Events
      </button>

      <div>
        <h1 className="headline text-[30px] leading-[1.12] tracking-tight">{event.name}</h1>
        <p className="mt-2 text-[15px] text-muted">{formatBetaEventWhen(day)}</p>
      </div>

      <div className="flex flex-col gap-3">
        <InterestButton
          label={waitlisted ? "On the waiting list" : "Join waiting list"}
          active={waitlisted}
          pending={pending}
          onClick={() => toggle("waitlist", waitlisted)}
        />
        <InterestButton
          label={selling ? "We'll contact you to post" : "I have an extra ticket"}
          active={selling}
          pending={pending}
          onClick={() => toggle("sell", selling)}
        />
      </div>

      {error && (
        <p role="alert" className="text-[13.5px] text-urgency">
          {error}
        </p>
      )}

      <p className="border-t border-hairline pt-4 text-[12.5px] text-muted">
        {SERVICE_FEE_LABEL}: {formatCad(SERVICE_FEE_CAD)} per ticket — collected when we confirm
        your handoff.
      </p>
    </div>
  );
}

function InterestButton({
  label,
  active,
  pending,
  onClick,
}: {
  label: string;
  active: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-[18px] px-5 py-4 text-left transition-colors disabled:opacity-60 ${
        active ? "bg-[#6ee1ff]/10" : "bg-white/[0.06] hover:bg-white/[0.09]"
      }`}
    >
      <span className="text-[15px] font-semibold">{label}</span>
      {active && <CheckIcon className="h-4 w-4 shrink-0 text-[#6ee1ff]" />}
    </button>
  );
}

function RequestEventView({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: (message: string) => void;
}) {
  const [state, setState] = useState<BetaActionState>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 self-start text-[13.5px] font-semibold text-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        Events
      </button>

      <p className="text-[14px] leading-relaxed text-muted">
        Once we get enough requests we can support your event!
      </p>

      <form
        className="flex flex-col gap-4"
        action={(fd) => {
          startTransition(async () => {
            const result = await submitBetaEventRequestAction({}, fd);
            setState(result);
            if (result.ok) onDone(result.message ?? "Request received.");
          });
        }}
      >
        <Field label="Event name" htmlFor="request-name">
          <input
            id="request-name"
            name="name"
            required
            placeholder="e.g. Café Campus Saturday"
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Details" htmlFor="request-details">
          <textarea
            id="request-details"
            name="details"
            rows={4}
            placeholder="Venue, date, link — whatever helps"
            className={`${FIELD_CLASS} resize-none`}
          />
        </Field>

        {state.error && (
          <p role="alert" className="text-[13.5px] text-urgency">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={`mt-2 ${BUTTON_CLASS}`}>
          {pending ? "Sending…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}
