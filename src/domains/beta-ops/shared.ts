import {
  betaEventBySlug,
  eventDayDateKey,
  isPastNightlife,
  supportedBetaEvents,
  INTEREST_OPTIONS,
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

/**
 * Partitions waitlist entries into active (tonight or upcoming) vs past (Thursday, Friday, etc.).
 */
export function partitionWaitlistEntries(
  entries: OpsWaitlistEntry[],
  now: Date = new Date(),
): { active: OpsWaitlistEntry[]; past: OpsWaitlistEntry[] } {
  const active: OpsWaitlistEntry[] = [];
  const past: OpsWaitlistEntry[] = [];

  for (const entry of entries) {
    const isPastCreation = isPastNightlife(entry.createdAt, now);
    const event = betaEventBySlug(entry.eventSlug);

    if (isPastCreation) {
      if (!event || !event.days || event.days.length === 0) {
        // Interest-only option (e.g. stereo) — interest remains active
        active.push(entry);
      } else {
        // If event has days that already passed (e.g. Thursday or Friday):
        const hasPassedDay = event.days.some((d) => eventDayDateKey(d, now).isPast);
        if (hasPassedDay) {
          past.push(entry);
        } else {
          // Future event (e.g. Piknik Électronik on Sunday)
          active.push(entry);
        }
      }
    } else {
      active.push(entry);
    }
  }

  return { active, past };
}

/**
 * Partitions seller leads into active (tonight/upcoming) vs past.
 */
export function partitionSellerLeads<T extends { createdAt: string }>(
  leads: T[],
  now: Date = new Date(),
): { active: T[]; past: T[] } {
  const active: T[] = [];
  const past: T[] = [];
  for (const lead of leads) {
    if (isPastNightlife(lead.createdAt, now)) {
      past.push(lead);
    } else {
      active.push(lead);
    }
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
    if (event.days && event.days.length > 0) {
      for (const day of event.days) {
        const schedule = eventDayDateKey(day, now);
        // Exclude dates that have passed (e.g. Thursday and Friday)
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
  }

  // 2. Add groups for any interest options or other entries present
  for (const entry of entries) {
    // Check if an upcoming group already exists for this event
    const existingKey = [...groupMap.keys()].find((k) => k.startsWith(`${entry.eventSlug}::`));
    if (existingKey) {
      const g = groupMap.get(existingKey)!;
      g.entries.push(entry);
      g.ticketDemand += entry.quantity;
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
