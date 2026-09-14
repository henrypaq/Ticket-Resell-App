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
  /** Seat paused after strikes — buyer can reactivate. */
  dormant: boolean;
  /** Live exclusive offer for this seat, if any. */
  activeOfferId: string | null;
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

/**
 * What someone typed into a flow they didn't finish.
 *
 * A `beta_go_contacts` row only exists once a lead is submitted, so an
 * abandoned flow used to leave nothing behind and asked for everything again
 * on the next visit. This holds the same fields the flows collect, written as
 * they step forward, and is read only for prefilling.
 */
export const QUICK_DRAFT_COOKIE = "passe_draft";

export type QuickContactDraft = {
  phone?: string | null;
  instagram?: string | null;
  name?: string | null;
  email?: string | null;
};

/**
 * What the save-profile card starts from — assembled from the /go contact
 * cookie and the most recent lead, so someone who just finished a flow only
 * has to fill the gaps.
 */
export type ProfilePrefillData = {
  name: string | null;
  email: string | null;
  phone: string | null;
  intent: "buy" | "sell" | null;
  eventName: string | null;
  referralSource: string | null;
};
