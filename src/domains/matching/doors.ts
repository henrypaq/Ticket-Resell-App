/**
 * When do doors open for a beta event?
 *
 * Matching needs this because both clocks shorten as the event approaches, and
 * inside a couple of hours nothing is held on a promise at all. Leads carry
 * only an `event_slug` and beta events are weekday-shaped (`cafe-campus` runs
 * Tuesday–Saturday), so "the doors time" is really "the next
 * occurrence of this event's nearest upcoming night".
 *
 * Pure helpers take a `BetaEvent`; slug helpers load the live catalog (DB +
 * static seeds) so ops-created nights get the right clocks.
 */

import {
  DEFAULT_DOORS_HOUR,
  betaEventBySlug,
  eventDayDateKey,
  montrealDateParts,
  nightlifeDateKey,
  type BetaEvent,
  type BetaWeekday,
} from "@/lib/beta-events";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The UTC instant of `hour:00` Montreal local time on a `YYYY-MM-DD` date.
 *
 * Solved by iteration rather than a hardcoded -4/-5: the offset depends on the
 * instant you're asking about, which is the thing being computed. Two passes
 * converge for every case including the DST changeovers; the third is belt and
 * braces.
 */
export function montrealInstant(dateKey: string, hour: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return new Date(NaN);

  const target = Date.UTC(year, month - 1, day, hour);
  let guess = target;

  for (let i = 0; i < 3; i += 1) {
    const parts = montrealDateParts(new Date(guess));
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour);
    const offset = localAsUtc - guess;
    const next = target - offset;
    if (next === guess) break;
    guess = next;
  }

  return new Date(guess);
}

export function doorsHourFor(event: BetaEvent | undefined): number {
  return event?.doorsHour ?? DEFAULT_DOORS_HOUR;
}

/** Sync fallback for static seeds / tests. Prefer `resolveDoorsHourForEvent`. */
export function doorsHourForEvent(eventSlug: string): number {
  return doorsHourFor(betaEventBySlug(eventSlug));
}

export async function resolveDoorsHourForEvent(eventSlug: string): Promise<number> {
  const { getBetaEventBySlug } = await import("@/domains/beta-events/catalog");
  return doorsHourFor((await getBetaEventBySlug(eventSlug)) ?? betaEventBySlug(eventSlug));
}

/**
 * Doors for the nearest upcoming night of this event, or null when the event
 * has no scheduled nights at all.
 */
export function doorsAtFor(event: BetaEvent | undefined, now: Date = new Date()): Date | null {
  if (!event) return null;

  const hour = doorsHourFor(event);
  const currentKey = nightlifeDateKey(now);
  const fromDays = (event.days ?? []).map((day: BetaWeekday) => {
    const s = eventDayDateKey(day, now);
    return { dateKey: s.dateKey, isPast: s.isPast };
  });
  const fromExtra = (event.extraDateKeys ?? []).map((dateKey) => ({
    dateKey,
    isPast: dateKey < currentKey,
  }));
  const schedules = [...fromDays, ...fromExtra];
  if (schedules.length === 0) return null;

  const upcoming = schedules
    .filter((s) => !s.isPast)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  if (upcoming.length > 0) {
    const next = upcoming[0]!;
    return montrealInstant(next.dateKey, hour);
  }

  const earliest = [...schedules].sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0]!;
  const base = montrealInstant(earliest.dateKey, hour);
  if (Number.isNaN(base.getTime())) return null;
  const rolled = new Date(base.getTime() + 7 * DAY_MS);
  const parts = montrealDateParts(rolled);
  const rolledKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  return montrealInstant(rolledKey, hour);
}

/** Sync fallback using static seeds. Prefer `resolveDoorsAtForEvent` in matching. */
export function doorsAtForEvent(eventSlug: string, now: Date = new Date()): Date | null {
  return doorsAtFor(betaEventBySlug(eventSlug), now);
}

export async function resolveDoorsAtForEvent(
  eventSlug: string,
  now: Date = new Date(),
): Promise<Date | null> {
  const { getBetaEventBySlug } = await import("@/domains/beta-events/catalog");
  const event = (await getBetaEventBySlug(eventSlug)) ?? betaEventBySlug(eventSlug);
  return doorsAtFor(event, now);
}
