import {
  BETA_EVENTS,
  belongsToLiveNight,
  betaEventBySlug,
  eventDayDateKey,
  eventListedOnNight,
  nightlifeDateKeyFromIso,
  supportedBetaEvents,
  INTEREST_OPTIONS,
  type BetaEvent,
  type BetaWeekday,
} from "../../lib/beta-events";

export const LEAD_STATUSES = ["new", "contacted", "matched", "done", "cancelled"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type QuickLeadRow = {
  id: string;
  intent: "buy" | "sell";
  eventSlug: string;
  eventName: string;
  quantity: number;
  contactPhone: string | null;
  contactInstagram: string | null;
  transferFirstName: string | null;
  transferLastName: string | null;
  transferEmail: string | null;
  paidEach: number | null;
  askEach: number | null;
  ticketShareUrl: string | null;
  ticketEvidencePath: string | null;
  etransferName: string | null;
  etransferEmail: string | null;
  etransferPhone: string | null;
  status: LeadStatus;
  adminNotes: string | null;
  acquisitionChannel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClassicInterest = {
  eventSlug: string;
  eventName: string;
  intent: "waitlist" | "sell";
  contactPhone: string | null;
  contactInstagram: string | null;
};

export type ClassicMemberRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  intent: "buy" | "sell" | "both";
  interestedEvents: string[];
  priority: string;
  school: string | null;
  referralSource: string | null;
  acquisitionChannel: string | null;
  createdAt: string;
  interests: ClassicInterest[];
};

export type QueuePaddingRow = {
  eventSlug: string;
  eventName: string;
  fakeFront: number;
};

/** Unified waitlist row for ops — classic questionnaire + /go buy leads. */
export type OpsWaitlistEntry = {
  id: string;
  source: "classic" | "go";
  name: string | null;
  email: string | null;
  eventSlug: string;
  eventName: string;
  /** Weeknights this event runs (from beta-events config). */
  eventDays: string[];
  quantity: number;
  /** What the user sees (real rank + fake front). */
  displayedPosition: number;
  contactPhone: string | null;
  contactInstagram: string | null;
  status: LeadStatus | "classic";
  acquisitionChannel: string | null;
  adminNotes: string | null;
  createdAt: string;
  /** Present for /go leads so status/notes actions keep working. */
  goLead?: QuickLeadRow;
};

export type OpsEventGroup<T extends { eventSlug: string; eventName: string; eventDays: string[]; quantity: number }> = {
  eventSlug: string;
  eventName: string;
  eventDays: string[];
  entries: T[];
  ticketDemand: number;
};

export type OpsWaitlistGroup = {
  key: string;
  eventSlug: string;
  eventName: string;
  dateLabel: string;
  dateKey: string;
  isTonight: boolean;
  entries: OpsWaitlistEntry[];
  ticketDemand: number;
};

function eventFromCatalog(slug: string, events: BetaEvent[]): BetaEvent | undefined {
  return events.find((event) => event.slug === slug) ?? betaEventBySlug(slug);
}

/**
 * Tonight vs previous nights.
 * Recurring venues only keep people who joined this nightlife date.
 * A one-off stays in tonight until its scheduled date passes.
 * Undated interest stays active.
 */
export function partitionWaitlistEntries(
  entries: OpsWaitlistEntry[],
  now: Date = new Date(),
  events: BetaEvent[] = BETA_EVENTS,
): { active: OpsWaitlistEntry[]; past: OpsWaitlistEntry[] } {
  const active: OpsWaitlistEntry[] = [];
  const past: OpsWaitlistEntry[] = [];

  for (const entry of entries) {
    const event = eventFromCatalog(entry.eventSlug, events);
    if (belongsToLiveNight(entry.createdAt, event, now)) active.push(entry);
    else past.push(entry);
  }

  return { active, past };
}

/**
 * Partitions seller leads into active (tonight/upcoming) vs past.
 * Leads with an event slug use the same night rule as the waitlist.
 */
export function partitionSellerLeads<T extends { createdAt: string; eventSlug?: string }>(
  leads: T[],
  now: Date = new Date(),
  events: BetaEvent[] = BETA_EVENTS,
): { active: T[]; past: T[] } {
  const active: T[] = [];
  const past: T[] = [];
  for (const lead of leads) {
    const event = lead.eventSlug ? eventFromCatalog(lead.eventSlug, events) : undefined;
    const live = lead.eventSlug
      ? belongsToLiveNight(lead.createdAt, event, now)
      : belongsToLiveNight(lead.createdAt, undefined, now);
    if (live) active.push(lead);
    else past.push(lead);
  }
  return { active, past };
}

/**
 * Group active waitlist entries into separate cards/modals by date:
 * - Each upcoming date gets its own group (e.g. Café Campus · Saturday Sep 12th).
 * - Dates that have passed (Thursday, Friday) are excluded.
 * - Groups are sorted chronologically from first to last date (tonight first, then tomorrow, then interest).
 */
export function groupOpsWaitlistByEventDate(
  entries: OpsWaitlistEntry[],
  now: Date = new Date(),
): OpsWaitlistGroup[] {
  const groups: OpsWaitlistGroup[] = [];
  const groupMap = new Map<string, OpsWaitlistGroup>();

  // 1. Initialize groups for supported live events with their upcoming dates
  const supported = supportedBetaEvents();
  for (const event of supported) {
    const scheduledDays = new Set<BetaWeekday>();
    for (const day of event.days ?? []) {
      scheduledDays.add(day);
    }
    for (const dateKey of event.extraDateKeys ?? []) {
      // Map each one-off date onto its weekday for grouping.
      const [y, m, d] = dateKey.split("-").map(Number);
      if (!y || !m || !d) continue;
      const utc = new Date(Date.UTC(y, m - 1, d, 17));
      const weekday = utc.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "UTC",
      }) as BetaWeekday;
      scheduledDays.add(weekday);
    }

    for (const day of scheduledDays) {
      const schedule = eventDayDateKey(day, now);
      if (!eventListedOnNight(event, day, schedule.dateKey)) continue;
      if (schedule.isPast) continue;

      const key = `${event.slug}::${day}`;
      const group: OpsWaitlistGroup = {
        key,
        eventSlug: event.slug,
        eventName: event.name,
        dateLabel: `${schedule.label}${schedule.isTonight ? " · Tonight" : ""}`,
        dateKey: schedule.dateKey,
        isTonight: schedule.isTonight,
        entries: [],
        ticketDemand: 0,
      };
      groupMap.set(key, group);
      groups.push(group);
    }
  }

  // 2. Add groups for any interest options or other entries present.
  // A person belongs on the night they joined — never on every future date
  // the venue also runs.
  for (const entry of entries) {
    const event = betaEventBySlug(entry.eventSlug);
    const createdKey = nightlifeDateKeyFromIso(entry.createdAt);
    const dated = [...groupMap.values()].filter(
      (g) => g.eventSlug === entry.eventSlug && g.dateKey !== "9999-99-99",
    );
    const exact = createdKey ? dated.find((g) => g.dateKey === createdKey) : undefined;
    const oneOff =
      dated.length === 1 &&
      event != null &&
      event.days.length === 0 &&
      (event.extraDateKeys?.length ?? 0) > 0 &&
      belongsToLiveNight(entry.createdAt, event, now);
    const target = exact ?? (oneOff ? dated[0] : undefined);
    if (target) {
      target.entries.push(entry);
      target.ticketDemand += entry.quantity;
    } else if (dated.length > 0) {
      // Joined on a night that is not one of the upcoming cards.
    } else {
      // Interest-only or unscheduled event
      const key = `${entry.eventSlug}::interest`;
      let g = groupMap.get(key);
      if (!g) {
        const eventDef = betaEventBySlug(entry.eventSlug);
        const optDef = INTEREST_OPTIONS.find((o) => o.value === entry.eventSlug);
        g = {
          key,
          eventSlug: entry.eventSlug,
          eventName: eventDef?.name ?? optDef?.label ?? entry.eventName,
          dateLabel: "Interest only",
          dateKey: "9999-99-99",
          isTonight: false,
          entries: [],
          ticketDemand: 0,
        };
        groupMap.set(key, g);
        groups.push(g);
      }
      g.entries.push(entry);
      g.ticketDemand += entry.quantity;
    }
  }

  // 3. Sort entries within each group by displayedPosition
  for (const group of groups) {
    group.entries.sort((a, b) => a.displayedPosition - b.displayedPosition);
  }

  // 4. Sort groups from first to last date (dateKey ascending), then alphabetically by name
  return groups
    .filter((g) => g.entries.length > 0 || supported.some((s) => s.slug === g.eventSlug))
    .sort((a, b) => {
      if (a.dateKey !== b.dateKey) {
        return a.dateKey.localeCompare(b.dateKey);
      }
      return a.eventName.localeCompare(b.eventName);
    });
}

/** Group ops rows by event; sort entries with an optional comparator (e.g. by #). */
export function groupOpsEntriesByEvent<
  T extends { eventSlug: string; eventName: string; eventDays: string[]; quantity: number },
>(
  entries: T[],
  sortEntries?: (a: T, b: T) => number,
): OpsEventGroup<T>[] {
  const map = new Map<string, OpsEventGroup<T>>();
  for (const entry of entries) {
    let group = map.get(entry.eventSlug);
    if (!group) {
      group = {
        eventSlug: entry.eventSlug,
        eventName: entry.eventName,
        eventDays: entry.eventDays,
        entries: [],
        ticketDemand: 0,
      };
      map.set(entry.eventSlug, group);
    }
    group.entries.push(entry);
    group.ticketDemand += entry.quantity;
  }

  for (const group of map.values()) {
    if (sortEntries) group.entries.sort(sortEntries);
  }

  return [...map.values()].sort((a, b) => a.eventName.localeCompare(b.eventName));
}
