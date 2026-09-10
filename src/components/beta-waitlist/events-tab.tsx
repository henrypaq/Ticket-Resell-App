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
  formatBetaEventWhen,
  supportedBetaEvents,
  type BetaEvent,
  type BetaWeekday,
} from "@/lib/beta-events";
import { SERVICE_FEE_CAD, SERVICE_FEE_LABEL } from "@/lib/compliance/fees";
import { formatCad } from "@/lib/format";
import { ArrowLeft, CheckIcon } from "@/components/icons";
import { PosterScrim } from "@/components/event-cards";
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

  return (
    <div className="flex flex-col gap-10">
      {flash && (
        <p role="status" className="rounded-2xl border border-[#6ee1ff]/25 bg-[#6ee1ff]/10 px-4 py-3 text-[13.5px] text-ink">
          {flash}
        </p>
      )}

      {groups.map(([day, events], index) => (
        <section
          key={day}
          className={index > 0 ? "border-t border-white/10 pt-10" : undefined}
        >
          <p className="section-header mb-4 text-[13px] tracking-[0.08em] text-ink">{day}</p>
          <div className="grid grid-cols-2 gap-3">
            {events.map((event) => (
              <button
                key={`${event.slug}-${day}`}
                type="button"
                onClick={() => openEvent(event, day)}
                className="relative block aspect-[3/4] w-full overflow-hidden rounded-2xl text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.flyerUrl} alt="" className="h-full w-full object-cover" />
                <PosterScrim />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <h2 className="headline text-[17px] leading-tight text-ink">{event.name}</h2>
                </div>
              </button>
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

        <button
          type="submit"
          disabled={pending}
          className={`mt-2 ${BUTTON_CLASS}`}
        >
          {pending ? "Sending…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}
