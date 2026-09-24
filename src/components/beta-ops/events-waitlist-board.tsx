"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  createCatalogEventAction,
  toggleCatalogEventAction,
  updateCatalogEventAction,
  type CreateEventState,
  type UpdateEventState,
} from "@/domains/beta-events/actions";
import { deleteWaitlistEntryAction, updateLeadStatusAction } from "@/domains/beta-ops/actions";
import {
  LEAD_STATUSES,
  type LeadStatus,
  type OpsWaitlistEntry,
} from "@/domains/beta-ops/shared";
import { BETA_WEEKDAYS, type BetaEvent, type BetaWeekday } from "@/lib/beta-events";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type CatalogRow = BetaEvent & { source: "db" | "static"; flyerPath: string | null };

const initial: CreateEventState = {};

/**
 * Combined Events + Waitlist: catalog create/list, click an event to see its queue.
 */
export function EventsWaitlistBoard({
  events,
  waitlistBySlug,
  fakeFrontSlot,
}: {
  events: CatalogRow[];
  waitlistBySlug: Record<string, OpsWaitlistEntry[]>;
  fakeFrontSlot?: React.ReactNode;
}) {
  // Include waitlist-only slugs that aren't in the catalog yet.
  const waitlistOnly = Object.keys(waitlistBySlug).filter(
    (slug) => !events.some((e) => e.slug === slug) && waitlistBySlug[slug]!.length > 0,
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Events</h1>
          <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
            Create nights, then tap an event to see who’s on the waitlist.
          </p>
        </div>
        {fakeFrontSlot}
      </div>

      <CreateEventForm />

      <section>
        <h2 className="text-sm font-semibold text-zinc-100">Board + waitlists</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Tap a row to expand the live waitlist for that event.
        </p>
        {events.length === 0 && waitlistOnly.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No events yet — create one above.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {events.map((event) => (
              <EventWaitlistRow
                key={`${event.source}-${event.slug}`}
                event={event}
                waitlist={waitlistBySlug[event.slug] ?? []}
              />
            ))}
            {waitlistOnly.map((slug) => {
              const entries = waitlistBySlug[slug] ?? [];
              return (
                <EventWaitlistRow
                  key={`waitlist-only-${slug}`}
                  event={{
                    slug,
                    name: entries[0]?.eventName ?? slug,
                    venue: "",
                    city: "Montreal",
                    blurb: "",
                    flyerUrl: "",
                    days: [],
                    supported: false,
                    source: "static",
                    flyerPath: null,
                  }}
                  waitlist={entries}
                  waitlistOnly
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function EventWaitlistRow({
  event,
  waitlist,
  waitlistOnly,
}: {
  event: CatalogRow;
  waitlist: OpsWaitlistEntry[];
  waitlistOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const schedule = formatSchedule(event);
  const tickets = waitlist.reduce((n, e) => n + e.quantity, 0);

  return (
    <li className="rounded-lg bg-zinc-900/60">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (open) setEditing(false);
        }}
        className="flex w-full gap-3 p-3 text-left focus:outline-none"
        aria-expanded={open}
      >
        {event.flyerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.flyerUrl}
            alt=""
            className="h-16 w-12 shrink-0 rounded-md object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-[10px] text-zinc-500">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[13px] font-semibold text-zinc-100">{event.name}</p>
            {!waitlistOnly && (
              <Badge variant="secondary" className="text-[10px]">
                {event.supported ? "live" : "hidden"}
              </Badge>
            )}
            {event.fixedPriceEach != null && (
              <Badge variant="warning" className="text-[10px]">
                ${event.fixedPriceEach.toFixed(0)} fixed
              </Badge>
            )}
            {waitlistOnly && (
              <Badge variant="outline" className="text-[10px] text-zinc-500">
                waitlist only
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-zinc-400">
            {[event.venue, schedule].filter(Boolean).join(" · ") || "No schedule"}
          </p>
          <p className="mt-1 text-[11px] tabular-nums text-zinc-500">
            {waitlist.length} in line
            {tickets > 0 ? ` · ×${tickets} tickets` : ""}
          </p>
        </div>
        <span className="shrink-0 self-center text-zinc-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-800/80 px-3 pb-3 pt-2">
          {!waitlistOnly && (
            <div className="mb-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                className="h-7 px-2 text-[11px]"
                onClick={(e) => {
                  e.stopPropagation();
                  start(async () => {
                    const result = await toggleCatalogEventAction(event.slug, !event.supported);
                    if (result.error) window.alert(result.error);
                    router.refresh();
                  });
                }}
              >
                {pending ? "…" : event.supported ? "Unpublish" : "Publish"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={editing ? "default" : "outline"}
                className="h-7 px-2 text-[11px]"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing((v) => !v);
                }}
              >
                {editing ? "Close edit" : "Edit event"}
              </Button>
              <span className="self-center font-mono text-[10px] text-zinc-600">{event.slug}</span>
            </div>
          )}

          {editing && !waitlistOnly && (
            <EditEventForm event={event} onDone={() => setEditing(false)} />
          )}

          {waitlist.length === 0 ? (
            <p className="py-2 text-xs text-zinc-500">No one on the waitlist for this event yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {waitlist.map((entry) => (
                <WaitlistMemberRow key={`${entry.source}-${entry.id}`} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

const updateInitial: UpdateEventState = {};

function EditEventForm({
  event,
  onDone,
}: {
  event: CatalogRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateCatalogEventAction, updateInitial);
  const hasRecurring = event.days.length > 0;
  const [mode, setMode] = useState<"one_off" | "recurring">(
    hasRecurring ? "recurring" : "one_off",
  );

  if (state.ok) {
    return (
      <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <p className="text-xs font-semibold text-emerald-200">{state.message ?? "Saved."}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-[11px]"
          onClick={() => {
            onDone();
            router.refresh();
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mb-3 flex flex-col gap-2.5 rounded-lg border border-zinc-700/70 bg-zinc-950/50 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        Edit event
      </p>
      <input type="hidden" name="slug" value={event.slug} />
      <input type="hidden" name="existingFlyerUrl" value={event.flyerUrl} />
      <input type="hidden" name="existingFlyerPath" value={event.flyerPath ?? ""} />
      <input type="hidden" name="scheduleMode" value={mode} />

      <div className="flex gap-3">
        {event.flyerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.flyerUrl}
            alt=""
            className="h-20 w-14 shrink-0 rounded-md object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-[10px] text-zinc-500">
            No image
          </div>
        )}
        <Field label="Replace flyer (optional)">
          <input
            name="flyer"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-[11px] text-zinc-400 file:mr-2 file:rounded-md file:border-0 file:bg-zinc-800 file:px-2.5 file:py-1 file:text-[11px] file:font-medium file:text-zinc-100"
          />
        </Field>
      </div>

      <Field label="Title">
        <input name="name" required defaultValue={event.name} className={inputClass} />
      </Field>
      <Field label="Venue">
        <input name="venue" required defaultValue={event.venue} className={inputClass} />
      </Field>
      <Field label="City">
        <input name="city" defaultValue={event.city || "Montreal"} className={inputClass} />
      </Field>
      <Field label="Details / blurb">
        <textarea
          name="blurb"
          rows={3}
          defaultValue={event.blurb}
          className={`${inputClass} resize-none`}
        />
      </Field>
      <Field label="Entry note (optional)">
        <input
          name="entryNote"
          defaultValue={event.entryNote ?? ""}
          placeholder="e.g. Doors close at midnight"
          className={inputClass}
        />
      </Field>
      <Field label="Doors hour (0–23, optional)">
        <input
          name="doorsHour"
          type="number"
          min={0}
          max={23}
          defaultValue={event.doorsHour ?? ""}
          placeholder="22"
          className={inputClass}
        />
      </Field>

      <FixedPriceFields initialPrice={event.fixedPriceEach} />

      <div>
        <p className="text-[11px] font-medium text-zinc-400">Schedule</p>
        <div className="mt-1.5 flex gap-2">
          <ModeChip active={mode === "one_off"} onClick={() => setMode("one_off")} label="One night" />
          <ModeChip
            active={mode === "recurring"}
            onClick={() => setMode("recurring")}
            label="Recurring weekdays"
          />
        </div>
        {mode === "one_off" ? (
          <input
            name="oneOffDate"
            type="date"
            required
            defaultValue={event.extraDateKeys?.[0] ?? ""}
            className={`${inputClass} mt-2`}
          />
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {BETA_WEEKDAYS.map((day) => (
              <label
                key={day}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-950/70 px-2 py-1.5 text-[11px] text-zinc-300"
              >
                <input
                  type="checkbox"
                  name="days"
                  value={day}
                  defaultChecked={event.days.includes(day)}
                  className="accent-amber-400"
                />
                {day.slice(0, 3)}
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          name="supported"
          value="1"
          defaultChecked={event.supported}
          className="accent-amber-400"
        />
        Live on the app (buy / sell / upcoming)
      </label>

      {state.error && (
        <p className="text-xs text-red-300" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-[11px]"
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="h-8 bg-amber-400 text-[11px] font-semibold text-zinc-950 hover:bg-amber-300"
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function WaitlistMemberRow({ entry }: { entry: OpsWaitlistEntry }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const href = contactHref(entry);
  const label = contactLabel(entry);

  function setStatus(status: LeadStatus) {
    if (!entry.goLead) return;
    start(async () => {
      await updateLeadStatusAction(entry.goLead!.id, status);
      router.refresh();
    });
  }

  return (
    <li className="rounded-lg bg-zinc-950/40 p-2.5">
      <div className="flex items-center gap-2.5">
        <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-zinc-400">
          #{entry.displayedPosition}
        </span>
        <div className="min-w-0 flex-1">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-xs font-medium text-zinc-200 hover:text-zinc-50"
              onClick={(e) => e.stopPropagation()}
            >
              {label}
            </a>
          ) : (
            <span className="truncate text-xs font-medium text-zinc-200">{label}</span>
          )}
          <p className="mt-0.5 text-[10px] text-zinc-500">
            {entry.source} · ×{entry.quantity}
            {entry.status !== "classic" ? ` · ${entry.status}` : ""}
          </p>
        </div>
        {entry.goLead && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] text-zinc-400"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Less" : "Edit"}
          </Button>
        )}
        <OpsDeleteButton
          confirmMessage={`Remove #${entry.displayedPosition} (${label}) from ${entry.eventName}?`}
          onConfirm={() => deleteWaitlistEntryAction(entry.source, entry.id)}
        />
      </div>
      {expanded && entry.goLead && (
        <div className="mt-2 flex flex-wrap gap-1">
          {LEAD_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={entry.status === status ? "default" : "outline"}
              disabled={pending}
              className="h-6 px-2 text-[10px] uppercase"
              onClick={() => setStatus(status)}
            >
              {status}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}

function contactLabel(entry: OpsWaitlistEntry) {
  if (entry.name) return entry.name;
  if (entry.contactInstagram) return `@${entry.contactInstagram}`;
  if (entry.contactPhone) return entry.contactPhone;
  if (entry.email) return entry.email;
  return "Anonymous";
}

function contactHref(entry: OpsWaitlistEntry) {
  if (entry.contactPhone) {
    return `https://wa.me/${entry.contactPhone.replace(/\D/g, "")}`;
  }
  if (entry.contactInstagram) {
    return `https://instagram.com/${entry.contactInstagram}`;
  }
  if (entry.email) return `mailto:${entry.email}`;
  return null;
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
            router.refresh();
            window.location.href = "/ops/events";
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
        Title, date, flyer — then post it. Posted events show on home, upcoming, and buy/sell.
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
          <input name="entryNote" placeholder="e.g. Doors close at midnight" className={inputClass} />
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

        <FixedPriceFields />

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
            <input name="oneOffDate" type="date" required className={`${inputClass} mt-2`} />
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

function FixedPriceFields({ initialPrice }: { initialPrice?: number }) {
  const [enabled, setEnabled] = useState(initialPrice != null && initialPrice >= 0);

  return (
    <div className="rounded-lg border border-zinc-700/70 bg-zinc-950/40 p-3">
      <label className="flex items-start gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          name="fixedPriceEnabled"
          value="1"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 accent-amber-400"
        />
        <span>
          <span className="font-semibold text-zinc-100">Predetermined price</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">
            Buyer-focused: they see a fixed price breakdown and cannot set their own max. Sell
            listings for this event should match this price.
          </span>
        </span>
      </label>
      {enabled && (
        <Field label="Ticket price (CAD each)">
          <input
            name="fixedPriceEach"
            type="number"
            inputMode="decimal"
            min={0}
            max={5000}
            step="0.01"
            required
            defaultValue={initialPrice ?? ""}
            placeholder="40.00"
            className={`${inputClass} mt-2`}
          />
        </Field>
      )}
    </div>
  );
}

function formatSchedule(event: BetaEvent): string {
  const days = event.days as BetaWeekday[];
  if (days.length) return days.map((d) => d.slice(0, 3)).join(", ");
  if (event.extraDateKeys?.length) return event.extraDateKeys.join(", ");
  return "";
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
      className={`rounded-md px-3 py-1.5 text-[11px] font-medium ${
        active ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-400"
      }`}
    >
      {label}
    </button>
  );
}

const inputClass =
  "rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none";
