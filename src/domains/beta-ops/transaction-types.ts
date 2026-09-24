/** Shared ops transaction queue types — safe for client components. */

export type OpsPerson = {
  name: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  etransferEmail: string | null;
  etransferPhone: string | null;
};

export type OpsPaymentQueueItem = {
  kind: "payment_verify";
  offerId: string;
  eventSlug: string;
  eventName: string;
  priceEach: number;
  memoHint: string;
  buyerDeclaredSentAt: string;
  paymentDueAt: string | null;
  buyer: OpsPerson;
  seller: OpsPerson;
};

export type OpsTicketCustodyItem = {
  kind: "ticket_verify";
  sellLeadId: string;
  eventSlug: string;
  eventName: string;
  quantity: number;
  askEach: number | null;
  sellerTicketSentAt: string;
  evidenceUrls: string[];
  ticketShareUrl: string | null;
  seller: OpsPerson;
};

export type OpsForwardTicketItem = {
  kind: "ticket_forward";
  offerId: string;
  sellLeadId: string | null;
  eventSlug: string;
  eventName: string;
  priceEach: number;
  paidAt: string | null;
  ticketReceivedAt: string | null;
  buyer: OpsPerson;
  seller: OpsPerson;
};

export type OpsPayoutItem = {
  kind: "payout";
  offerId: string;
  sellLeadId: string | null;
  eventSlug: string;
  eventName: string;
  amount: number;
  ticketForwardedAt: string | null;
  seller: OpsPerson;
};

export type OpsCompletedItem = {
  offerId: string;
  eventSlug: string;
  eventName: string;
  amount: number;
  payoutReleasedAt: string;
  /** Seller tapped “I received the money” from the payout email. */
  sellerPayoutConfirmedAt: string | null;
  ticketForwardedAt: string | null;
  buyerName: string | null;
  sellerName: string | null;
};

export type OpsFixedPriceTxnItem = {
  kind: "fixed_price";
  leadId: string;
  eventSlug: string;
  eventName: string;
  quantity: number;
  amount: number;
  memoHint: string;
  buyerDeclaredSentAt: string;
  paymentRecordedAt: string | null;
  ticketForwardedAt: string | null;
  /** Ticket transfer destination (name + email on the lead). */
  buyer: OpsPerson;
  status: "awaiting_payment" | "awaiting_ticket" | "done";
};

export type OpsTransactionsBoard = {
  paymentsToVerify: OpsPaymentQueueItem[];
  ticketsToVerify: OpsTicketCustodyItem[];
  ticketsToForward: OpsForwardTicketItem[];
  payoutsToSend: OpsPayoutItem[];
  /** Predetermined-price buys — Interac declare → confirm → forward ticket. */
  fixedPriceTxns: OpsFixedPriceTxnItem[];
  recentlyCompleted: OpsCompletedItem[];
  attentionCount: number;
};
