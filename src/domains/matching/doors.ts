/**
 * When do doors open for a beta event?
 *
 * Matching needs this because both clocks shorten as the event approaches, and
 * inside a couple of hours nothing is held on a promise at all. Leads carry
 * only an `event_slug` and beta events are weekday-shaped (`cafe-campus` runs
 * Tuesday–Saturday), so "the doors time" is really "the next
 * occurrence of this event's nearest upcoming night".
 *
 * Pure, and built entirely on the existing date helpers in `lib/beta-events` —
 * the pre-6am nightlife rule (a Saturday event is still tonight at 2am Sunday)
 * lives there and is not reimplemented here.
 */

import {
  DEFAULT_DOORS_HOUR,
  betaEventBySlug,
  eventDayDateKey,
  montrealDateParts,
  nightlifeDateKey,
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

export function doorsHourForEvent(eventSlug: string): number {
  return betaEventBySlug(eventSlug)?.doorsHour ?? DEFAULT_DOORS_HOUR;
}

/**
 * Doors for the nearest upcoming night of this event, or null when the event
 * has no scheduled nights at all (interest-only options like `stereo`, which
 * are demand signal rather than something with a date).
 *
 * A night that has already passed rolls forward a week rather than returning a
 * time in the past — a doors time behind `now` would read as "inside the open
 * window" and suppress exclusivity for an event that is actually days away.
 */
export function doorsAtForEvent(eventSlug: string, now: Date = new Date()): Date | null {
  const event = betaEventBySlug(eventSlug);
  if (!event) return null;

  const hour = doorsHourForEvent(eventSlug);
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
    const doors = montrealInstant(next.dateKey, hour);
    // Tonight's doors may already be behind us (it's 1am and the event started
    // at 22:00). The night is still live — nightlife dates run to 6am — but the
    // exclusivity window is over, so report doors as-is and let the policy
    // treat it as the open regime.
    return doors;
  }

  // Every night in this weekend cycle is behind us: next week's earliest.
  const earliest = [...schedules].sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0]!;
  const base = montrealInstant(earliest.dateKey, hour);
  if (Number.isNaN(base.getTime())) return null;
  // Re-resolve through the date key so the result stays correct across a DST
  // boundary inside that week rather than drifting by an hour.
  const rolled = new Date(base.getTime() + 7 * DAY_MS);
  const parts = montrealDateParts(rolled);
  const rolledKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  return montrealInstant(rolledKey, hour);
}
