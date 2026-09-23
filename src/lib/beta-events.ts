/**
 * Events shown on home / buy / sell / upcoming. Deliberately NOT a row in
 * `public.events` — that table drives the real resale-enabled listing flow
 * (pending/resale_enabled status, price-cap machinery, § hard constraints).
 *
 * Scheduling model (add nights manually — nothing auto-recycles a one-off):
 * - `days`: recurring weekdays that run every week (e.g. Café Campus Tue–Sat).
 * - `extraDateKeys`: specific Montreal nightlife dates (`YYYY-MM-DD`) for
 *   one-off shows. Put dates here when you schedule a new event; leave `days`
 *   empty so last week's frosh / concert does not reappear next Thursday.
 */
export type BetaEvent = {
  slug: string;
  name: string;
  venue: string;
  city: string;
  blurb: string;
  /** Poster art for the events-tab card — full-bleed, same convention as the real app's flyer_url. */
  flyerUrl: string;
  /**
   * Recurring weeknight(s). Empty means the event only appears on dates listed
   * in `extraDateKeys` — use that for manually scheduled one-offs.
   */
  days: BetaWeekday[];
  /**
   * One-off nightlife dates (YYYY-MM-DD, Montreal nightlife calendar). Add a
   * date here when you schedule a show; remove or leave past dates — they
   * stop listing once the night has passed.
   */
  extraDateKeys?: string[];
  /** When false, shown only as interest options / request targets, not live. */
  supported: boolean;
  /** Optional door / entry policy shown on posters (e.g. Café Campus cutoff). */
  entryNote?: string;
  /**
   * Montreal local hour doors open, 0-23. Drives how aggressively waitlist
   * matching shortens its clocks as the event approaches (see
   * `domains/matching/doors.ts`). Defaults to `DEFAULT_DOORS_HOUR` — set it
   * only for events that aren't late-night, like a Sunday afternoon Piknik.
   */
  doorsHour?: number;
};

/** Club night default. Overridden per event via `BetaEvent.doorsHour`. */
export const DEFAULT_DOORS_HOUR = 22;

export const BETA_WEEKDAYS = [
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
] as const;

export type BetaWeekday = (typeof BETA_WEEKDAYS)[number];

export const BETA_EVENTS: BetaEvent[] = [
  {
    slug: "cafe-campus",
    name: "Café Campus",
    venue: "Café Campus",
    city: "Montreal",
    blurb:
      "The first venue we're supporting — list a ticket you can't use, or join the waitlist for an exclusive hold when one opens.",
    flyerUrl: "/flyers/cafe-campus.jpg",
    // Recurring every weeknight café is open.
    days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    supported: true,
  },
  {
    slug: "montreal-frosh-muzique",
    name: "Montreal Frosh Night @ Muzique",
    venue: "Muzique",
    city: "Montreal",
    blurb: "Frosh night at Muzique — join the waitlist or list an extra when a date is scheduled.",
    flyerUrl: "/flyers/montreal-frosh-muzique.jpg",
    // Not on the public board until an admin adds nightlife dates.
    days: [],
    supported: false,
  },
  {
    slug: "niska-bell-center",
    name: "Niska @ Bell Center",
    venue: "Bell Centre",
    city: "Montreal",
    blurb: "Niska at the Bell Centre — join the waitlist for an exclusive hold when a ticket opens.",
    flyerUrl: "/flyers/niska-bell-center.jpg",
    days: [],
    supported: false,
  },
  {
    slug: "piknik-electronik",
    name: "Piknik Électronik",
    venue: "Parc Jean-Drapeau",
    city: "Montreal",
    blurb: "Sunday Piknik — join the waitlist or list a ticket you can't use when a date is scheduled.",
    flyerUrl: "/flyers/piknik-electronik.jpg",
    days: [],
    supported: false,
    // Daytime outdoor event, not a club night — used when a date is scheduled.
    doorsHour: 14,
  },
];

export function supportedBetaEvents(): BetaEvent[] {
  return BETA_EVENTS.filter((e) => e.supported);
}

/** True when this event should appear under a given nightlife day / date. */
export function eventListedOnNight(
  event: BetaEvent,
  day: BetaWeekday,
  dateKey: string,
): boolean {
  if (!event.supported) return false;
  if (event.days.includes(day)) return true;
  return event.extraDateKeys?.includes(dateKey) ?? false;
}

export function betaEventBySlug(slug: string): BetaEvent | undefined {
  return BETA_EVENTS.find((e) => e.slug === slug);
}

const CALENDAR_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const satisfies readonly BetaWeekday[];

/** Montreal calendar parts (date + hour) so Vercel UTC doesn't shift the night. */
export function montrealDateParts(from: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: BetaWeekday;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(from);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    weekday: get("weekday") as BetaWeekday,
  };
}

/**
 * Montreal nightlife date string "YYYY-MM-DD" for an instant.
 * Pre-6:00 AM counts as the previous calendar day's night (Thursday night
 * goes until Friday 5:59 AM).
 */
export function nightlifeDateKey(from: Date = new Date()): string {
  const { year, month, day, hour } = montrealDateParts(from);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (hour < 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dt = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dt}`;
}

/** Returns true if the timestamp was created during a prior Montreal nightlife date. */
export function isPastNightlife(isoTimestamp: string, now: Date = new Date()): boolean {
  try {
    const created = new Date(isoTimestamp);
    if (Number.isNaN(created.getTime())) return false;
    return nightlifeDateKey(created) < nightlifeDateKey(now);
  } catch {
    return false;
  }
}

export type EventDaySchedule = {
  day: BetaWeekday;
  dateKey: string;
  label: string;
  isPast: boolean;
  isTonight: boolean;
};

/**
 * Resolves a weekday relative to the current nightlife weekend cycle.
 * For example on Saturday: Thursday and Friday are past (-2, -1 days),
 * Saturday is tonight (0), Sunday is upcoming (+1).
 */
export function eventDayDateKey(
  day: BetaWeekday,
  now: Date = new Date(),
): EventDaySchedule {
  const parts = montrealDateParts(now);
  const currentKey = nightlifeDateKey(now);
  const currentWeekday = currentNightlifeWeekday(now);

  const currentIdx = CALENDAR_WEEKDAYS.indexOf(currentWeekday);
  const targetIdx = CALENDAR_WEEKDAYS.indexOf(day);

  let diff = targetIdx - currentIdx;
  if (diff > 3) diff -= 7;
  if (diff < -3) diff += 7;

  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (parts.hour < 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  d.setUTCDate(d.getUTCDate() + diff);

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dt = String(d.getUTCDate()).padStart(2, "0");
  const dateKey = `${y}-${m}-${dt}`;

  const isPast = dateKey < currentKey;
  const isTonight = dateKey === currentKey;

  const weekdayName = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const monthName = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const label = `${weekdayName} - ${monthName} ${ordinal(d.getUTCDate())}`;

  return { day, dateKey, label, isPast, isTonight };
}


/**
 * Nightlife "current night" in Montreal. Before 6:00am, still counts as the
 * previous calendar weekday (Thursday night → Friday 2am is still Thursday).
 */
export function currentNightlifeWeekday(from: Date = new Date()): BetaWeekday {
  const { weekday, hour } = montrealDateParts(from);
  if (hour >= 6) return weekday;
  const idx = CALENDAR_WEEKDAYS.indexOf(weekday);
  return CALENDAR_WEEKDAYS[(idx + 6) % 7]!;
}

/** @deprecated Prefer currentNightlifeWeekday — kept as an alias for call sites. */
export function currentBetaWeekday(from: Date = new Date()): BetaWeekday {
  return currentNightlifeWeekday(from);
}

/** Supported events happening tonight (Montreal nightlife day). */
export function tonightBetaEvents(from: Date = new Date()): BetaEvent[] {
  const day = currentNightlifeWeekday(from);
  const dateKey = nightlifeDateKey(from);
  return supportedBetaEvents().filter((e) => eventListedOnNight(e, day, dateKey));
}

/**
 * Weekdays from tonight forward for the next 7 nightlife days (Montreal).
 * Past nights in the week are excluded until they come around again.
 */
export function upcomingBetaWeekdays(from: Date = new Date()): BetaWeekday[] {
  const start = CALENDAR_WEEKDAYS.indexOf(currentNightlifeWeekday(from));
  return Array.from({ length: 7 }, (_, i) => CALENDAR_WEEKDAYS[(start + i) % 7]!);
}

/**
 * Events offered on buy & sell for the given night — ONLY tonight's events.
 * Empty when nothing is running; never falls forward to Thursday/Friday/etc.
 */
export function goSelectableEvents(from: Date = new Date()): BetaEvent[] {
  return tonightBetaEvents(from);
}

/**
 * Unique supported events that appear on the public board for any upcoming
 * nightlife day (same set as /upcoming). Use for buy/sell pickers so deep
 * links and "I need a ticket" never surface unlisted venues.
 */
export function boardSelectableEvents(from: Date = new Date()): BetaEvent[] {
  const seen = new Set<string>();
  const out: BetaEvent[] = [];
  for (const [, events] of groupEventsByUpcomingDays(supportedBetaEvents(), from)) {
    for (const event of events) {
      if (seen.has(event.slug)) continue;
      seen.add(event.slug);
      out.push(event);
    }
  }
  return out;
}

/**
 * Dropdown options for the given night — only events running tonight.
 */
export function tonightEventOptions(from: Date = new Date()): UpcomingEventOption[] {
  const day = currentNightlifeWeekday(from);
  return tonightBetaEvents(from).map((event) => ({
    key: `${event.slug}::${day}`,
    slug: event.slug,
    day,
    event,
    label: event.name,
  }));
}


/** Section label: "Today" for tonight, else e.g. "Saturday - September 13th". */
export function betaDaySectionLabel(day: BetaWeekday, from: Date = new Date()): string {
  if (day === currentNightlifeWeekday(from)) return "Today";
  return formatBetaEventWhen(day, from);
}

/**
 * Group live events under upcoming nightlife days only (Montreal).
 * Multi-day venues appear once under each remaining night they run.
 * Manually scheduled `extraDateKeys` land under the matching weekday.
 */
export function groupEventsByUpcomingDays(
  events: BetaEvent[],
  from: Date = new Date(),
): [BetaWeekday, BetaEvent[]][] {
  const byDay = new Map<BetaWeekday, BetaEvent[]>();
  for (const day of upcomingBetaWeekdays(from)) {
    const { dateKey } = eventDayDateKey(day, from);
    const list = events.filter((e) => eventListedOnNight(e, day, dateKey));
    if (list.length) byDay.set(day, list);
  }
  return [...byDay.entries()];
}

export type UpcomingEventOption = {
  /** Stable key for selects: slug + day */
  key: string;
  slug: string;
  day: BetaWeekday;
  event: BetaEvent;
  label: string;
};

/** Flat dropdown options for buy/sell — one row per upcoming night per venue. */
export function upcomingEventOptions(from: Date = new Date()): UpcomingEventOption[] {
  const options: UpcomingEventOption[] = [];
  for (const [day, events] of groupEventsByUpcomingDays(supportedBetaEvents(), from)) {
    for (const event of events) {
      options.push({
        key: `${event.slug}::${day}`,
        slug: event.slug,
        day,
        event,
        label: `${event.name} · ${formatBetaEventWhen(day, from)}`,
      });
    }
  }
  return options;
}

/** Next calendar date for a weekday name (Montreal time), including tonight if it matches. */
export function nextDateForWeekday(day: BetaWeekday, from: Date = new Date()): Date {
  const { year, month, day: dNum, hour } = montrealDateParts(from);
  const nightlife = currentNightlifeWeekday(from);
  const base = new Date(Date.UTC(year, month - 1, dNum, 17, 0, 0));
  // Pre-6am: nightlife is still "yesterday", so shift the calendar anchor back one day.
  if (hour < 6) base.setUTCDate(base.getUTCDate() - 1);
  const todayWeekday = CALENDAR_WEEKDAYS.indexOf(nightlife);
  const target = CALENDAR_WEEKDAYS.indexOf(day);
  const delta = (target - todayWeekday + 7) % 7;
  base.setUTCDate(base.getUTCDate() + delta);
  return base;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** e.g. "Thursday - September 10th" */
export function formatBetaEventWhen(day: BetaWeekday, from: Date = new Date()): string {
  const d = nextDateForWeekday(day, from);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return `${weekday} - ${month} ${ordinal(d.getUTCDate())}`;
}

/** e.g. "Tuesday 15/09" — compact date for home / posters. */
export function formatBetaEventWhenShort(day: BetaWeekday, from: Date = new Date()): string {
  const d = nextDateForWeekday(day, from);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${weekday} ${dd}/${mm}`;
}

/** Options shown on the "which events are you interested in" step. */
export const INTEREST_OPTIONS = [
  { value: "cafe-campus", label: "Café Campus" },
  { value: "montreal-frosh-muzique", label: "Montreal Frosh Night @ Muzique" },
  { value: "niska-bell-center", label: "Niska @ Bell Center" },
  { value: "piknik-electronik", label: "Piknik Électronik" },
  { value: "stereo", label: "Stereo" },
  { value: "new-city-gas", label: "New City Gas" },
  { value: "montreal-frosh-week", label: "Montreal Frosh Week" },
] as const;

/** Public socials for the beta shell header. Swap URLs when handles are final. */
export const BETA_SOCIALS = {
  instagram: "https://www.instagram.com/mcgill.tickets/",
  snapchat: "https://www.snapchat.com/add/passe.mtl",
} as const;
