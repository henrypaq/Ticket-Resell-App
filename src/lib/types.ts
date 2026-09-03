export type VerificationTier = "A" | "B";
export type ListingStatus = "active" | "reserved" | "sold" | "cancelled" | "expired";
export type EventStatus = "pending" | "discoverable" | "resale_enabled" | "rejected";
export type PriceSource =
  | "platform_parsed"
  | "admin_verified"
  | "user_submitted_unverified"
  | "producer_confirmed";
export type EscrowStatus = "none" | "held" | "released" | "refunded" | "disputed";
export type AdminActionType =
  | "event_approved"
  | "event_rejected"
  | "listing_flagged"
  | "listing_unflagged"
  | "listing_removed"
  | "payment_released"
  | "payment_refunded";

export type EventRow = {
  id: string;
  name: string;
  venue: string;
  city: string;
  starts_at: string;
  doors_close_at: string | null;
  source_platform: string;
  original_price: number;
  verification_tier: VerificationTier;
  flyer_url: string | null;
  tags: string[];
  is_sold_out: boolean;
  status: EventStatus;
  price_source: PriceSource;
  source_url: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  review_note: string | null;
};

export type ListingRow = {
  id: string;
  event_id: string;
  seller_id: string;
  price: number;
  status: ListingStatus;
  disclosure_snapshot: Record<string, unknown>;
  reserved_by: string | null;
  reserved_at: string | null;
  flagged_at: string | null;
  flagged_reason: string | null;
  removed_at: string | null;
  ticket_barcode_hash: string | null;
  ticket_evidence_path: string | null;
  ticket_evidence_uploaded_at: string | null;
  created_at: string;
};

export type TransactionRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  amount: number;
  fee_amount: number;
  escrow_status: EscrowStatus;
  verification_status: string;
  released_by: string | null;
  released_at: string | null;
  refunded_at: string | null;
  buyer_confirmed_at: string | null;
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  admin_note: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AdminActionRow = {
  id: string;
  admin_id: string;
  action_type: AdminActionType;
  target_type: string;
  target_id: string;
  notes: string | null;
  created_at: string;
};

export type EventWithSupply = EventRow & {
  active_listings: number;
  lowest_price: number | null;
};

export type LineupEntry = { name: string; role?: string };

export type OrganizerRow = {
  id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  bio: string | null;
};

/**
 * The richer shape used only by the single-event detail page. Kept separate
 * from EventRow so browse/grid queries (Upcoming, Search, waitlists) don't
 * drag the organizer join and description/lineup payload into a list that
 * only ever shows a title.
 */
export type EventDetailRow = EventRow & {
  description: string | null;
  lineup: LineupEntry[];
  organizer: OrganizerRow | null;
};

export type MinimalEventRow = {
  id: string;
  name: string;
  venue: string;
  city: string;
  starts_at: string;
  flyer_url: string | null;
};

export type PurchasedTicketRow = TransactionRow & { event: MinimalEventRow };

export type ListingWithEventRow = ListingRow & { event: MinimalEventRow };

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  event_ref_id: string | null;
  listing_ref_id: string | null;
  read_at: string | null;
  created_at: string;
};
