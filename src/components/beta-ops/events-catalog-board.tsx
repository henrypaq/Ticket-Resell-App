"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCatalogEventAction,
  toggleCatalogEventAction,
  type CreateEventState,
} from "@/domains/beta-events/actions";
import { BETA_WEEKDAYS, type BetaEvent, type BetaWeekday } from "@/lib/beta-events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type CatalogRow = BetaEvent & { source: "db" | "static"; flyerPath: string | null };

const initial: CreateEventState = {};

export function EventsCatalogBoard({ events }: { events: CatalogRow[] }) {
  return (
    <div className="flex flex-col gap-10">
      <CreateEventForm />
      <ExistingEventsList events={events} />
    </div>
  );
}

function CreateEventForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createCatalogEventAction, initial);
  const [mode, setMode] = useState<"one_off" | "recurring">("one_off");
  const [name, setName] = useState("");
  const slugPreview = useMemo(() => {
    const base = name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return base || "event-slug";
  }, [name]);

  if (state.ok) {
    return (
      <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <p className="text-sm font-semibold text-emerald-200">Event saved</p>
        <p className="mt-1 text-xs text-emerald-200/80">
          {state.message}{" "}
          <span className="font-mono text-[11px]">{state.slug}</span>
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 h-8 text-[11px]"
          onClick={() => {
            // Full reload rather than router.push: this board lives on
            // /ops/events, and the point is to clear the submitted action
            // state so the form comes back blank.
            router.refresh();
            window.location.reload();
          }}
        >
          Create another
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Create event</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        Title, date, flyer — then post it. Posted events show on home, upcoming, and buy/sell for
        the nights you set.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <Field label="Title">
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Niska @ Bell Centre"
            className={inputClass}
          />
        </Field>
        <Field label="Venue">
          <input name="venue" required placeholder="Bell Centre" className={inputClass} />
        </Field>
        <Field label="City">
          <input name="city" defaultValue="Montreal" className={inputClass} />
        </Field>
        <Field label="Short blurb">
          <textarea
            name="blurb"
            rows={2}
            placeholder="One or two sentences for the poster."
            className={`${inputClass} resize-none`}
          />
        </Field>
        <Field label="Entry note (optional)">
          <input
            name="entryNote"
            placeholder="e.g. Doors close at midnight"
            className={inputClass}
          />
        </Field>
        <Field label="Doors hour (0–23, optional — default 22)">
          <input
            name="doorsHour"
            type="number"
            min={0}
            max={23}
            placeholder="22"
            className={inputClass}
          />
        </Field>

        <div>
          <p className="text-[11px] font-medium text-zinc-400">Schedule</p>
          <div className="mt-1.5 flex gap-2">
            <ModeChip
              active={mode === "one_off"}
              onClick={() => setMode("one_off")}
              label="One night"
            />
            <ModeChip
              active={mode === "recurring"}
              onClick={() => setMode("recurring")}
              label="Recurring weekdays"
            />
          </div>
          <input type="hidden" name="scheduleMode" value={mode} />
          {mode === "one_off" ? (
            <input
              name="oneOffDate"
              type="date"
              required
              className={`${inputClass} mt-2`}
            />
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {BETA_WEEKDAYS.map((day) => (
                <label
                  key={day}
                  className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950/70 px-2 py-1.5 text-[11px] text-zinc-300"
                >
                  <input type="checkbox" name="days" value={day} className="accent-amber-400" />
                  {day.slice(0, 3)}
                </label>
              ))}
            </div>
          )}
        </div>

        <Field label="Flyer image">
          <input
            name="flyer"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-100"
          />
        </Field>

        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            name="supported"
            value="1"
            defaultChecked
            className="accent-amber-400"
          />
          Post to the app now (live on buy / sell / upcoming)
        </label>

        <p className="text-[10px] text-zinc-600">
          Slug preview: <span className="font-mono text-zinc-400">{slugPreview}</span>
          {mode === "one_off" ? "-YYYY-MM-DD" : ""}
        </p>

        {state.error && (
          <p className="text-xs text-red-300" role="alert">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="h-10 bg-amber-400 font-semibold text-zinc-950 hover:bg-amber-300"
        >
          {pending ? "Saving…" : "Create & post"}
        </Button>
      </form>
    </section>
  );
}

function ExistingEventsList({ events }: { events: CatalogRow[] }) {
  if (events.length === 0) {
    return (
      <p className="text-xs text-zinc-500">No events yet — create one above.</p>
    );
  }
  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-100">On the board</h2>
      <p className="mt-1 text-[11px] text-zinc-500">
        Toggle live to show or hide. Static seeds (Café Campus, etc.) can be overridden once you
        save a DB copy.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {events.map((event) => (
          <EventRow key={`${event.source}-${event.slug}`} event={event} />
        ))}
      </ul>
    </section>
  );
}

function EventRow({ event }: { event: CatalogRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const schedule = formatSchedule(event);

  return (
    <li className="flex gap-3 rounded-lg bg-zinc-900/60 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={event.flyerUrl}
        alt=""
        className="h-16 w-12 shrink-0 rounded-md object-cover ring-1 ring-white/10"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-zinc-100">{event.name}</p>
          <Badge variant="secondary" className="text-[10px]">
            {event.supported ? "live" : "hidden"}
          </Badge>
          <Badge variant="outline" className="text-[10px] text-zinc-500">
            {event.source}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-zinc-400">
          {event.venue} · {schedule}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{event.slug}</p>
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              start(async () => {
                const result = await toggleCatalogEventAction(event.slug, !event.supported);
                if (result.error) window.alert(result.error);
                router.refresh();
              });
            }}
          >
            {pending ? "…" : event.supported ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>
    </li>
  );
}

function formatSchedule(event: BetaEvent): string {
  const days = event.days as BetaWeekday[];
  if (days.length) return days.map((d) => d.slice(0, 3)).join(", ");
  if (event.extraDateKeys?.length) return event.extraDateKeys.join(", ");
  return "no dates";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function ModeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${
        active ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none";
