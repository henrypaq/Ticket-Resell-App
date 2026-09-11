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
