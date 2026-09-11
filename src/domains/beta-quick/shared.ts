export type QuickWaitlistEntry = {
  leadId: string;
  eventSlug: string;
  eventName: string;
  quantity: number;
  position: number;
  status: string;
  createdAt: string;
};

export type QuickActionState = { ok?: true; error?: string };

/** Cookie of buy lead UUIDs so /go can show queue position on return visits. */
export const QUICK_BUYER_COOKIE = "passe_quick_buyer";
