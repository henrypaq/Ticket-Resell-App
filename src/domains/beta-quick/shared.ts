export type QuickWaitlistEntry = {
  leadId: string;
  eventSlug: string;
  eventName: string;
  quantity: number;
  position: number;
  status: string;
  createdAt: string;
  contactPhone: string | null;
  contactInstagram: string | null;
};

/** Max tickets per /go buy waitlist or sell listing. */
export const QUICK_MAX_TICKETS = 2;

/** Activity tied to a /go contact cookie — no beta member signup required. */
export type GoActivityEntry = {
  leadId: string;
  intent: "buy" | "sell";
  eventSlug: string;
  eventName: string;
  quantity: number;
  status: string;
  paidEach: number | null;
  askEach: number | null;
  /** What the seller received when done (ask × qty), else null. */
  proceedsCad: number | null;
  /** Seller proceeds − original paid × qty when done; usually ≤ 0 at face cap. */
  netVsPaidCad: number | null;
  createdAt: string;
};

export type QuickActionState = { ok?: true; error?: string; message?: string };

/** Cookie of buy lead UUIDs so /go can show queue position on return visits. */
export const QUICK_BUYER_COOKIE = "passe_quick_buyer";
/** Cookie of sell lead UUIDs as a backup when the contact cookie is missing. */
export const QUICK_SELLER_COOKIE = "passe_quick_seller";
