import { parseLastSrc } from "@/lib/beta-acquisition";

const SITE = "https://mcgilltickets.party";

/**
 * Attribution tag for an event's scan-me poster. Slug-shaped and under the 40
 * characters `parseLastSrc` accepts, so the proxy stores it verbatim as
 * last-touch instead of collapsing it into the first-touch enum.
 */
export function campaignQrSrc(slug: string): string {
  const candidate = `qr_${slug.replace(/-/g, "_")}`.slice(0, 40).replace(/_+$/, "");
  return parseLastSrc(candidate) ?? "qr_event";
}

/** The buy flow, deep-linked to one event and tagged for attribution. */
export function eventBuyUrl(slug: string): string {
  return `${SITE}/buy?event=${encodeURIComponent(slug)}&src=${campaignQrSrc(slug)}`;
}
