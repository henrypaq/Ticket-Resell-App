/**
 * Client-safe shared types/constants for the beta signup domain.
 * Keep anything that UI components need here — `service.ts` is server-only
 * (admin client) and must not be imported from Client Components.
 */

export type BetaSignupProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notifyQueueEmail: boolean;
  notifyQueueSms: boolean;
  notifyTicketsEmail: boolean;
  notifyTicketsSms: boolean;
  interests: {
    eventSlug: string;
    intent: "waitlist" | "sell";
    contactPhone?: string | null;
    contactInstagram?: string | null;
  }[];
};

export const SUPPORT_CATEGORIES = [
  { value: "tickets", label: "Tickets / waitlist" },
  { value: "account", label: "Account / contact info" },
  { value: "payment", label: "Payment / fees" },
  { value: "bug", label: "Something broken" },
  { value: "other", label: "Other" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];
