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
