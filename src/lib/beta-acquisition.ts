/**
 * First-touch acquisition for the public beta landing.
 *
 * The Instagram bio uses the clean apex URL with no query string, so a bare
 * visit is attributed by sniffing the request (`looksLikeInstagram`) rather
 * than assumed to be a bio click. QR codes and campaign links append `?src=`,
 * which always wins. First cookie write wins — later links don't overwrite.
 */

export const ACQUISITION_CHANNELS = [
  "qr_share",
  "qr_print",
  "ig_bio",
  "manual",
  "friend",
  "campus",
  "other",
  /** Café Campus flyer creatives — each QR stamps its own channel. */
  "cafe_soldout",
  "cafe_extra",
  "cafe_hungover",
  "cafe_funnybuyer",
] as const;

export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number];

/** Channels that may be set from a `?src=` URL (not ops-only labels). */
export const URL_ACQUISITION_CHANNELS = [
  "qr_share",
  "qr_print",
  "ig_bio",
  "cafe_soldout",
  "cafe_extra",
  "cafe_hungover",
  "cafe_funnybuyer",
] as const satisfies readonly AcquisitionChannel[];

export type FlyerAcquisitionChannel =
  | "cafe_soldout"
  | "cafe_extra"
  | "cafe_hungover"
  | "cafe_funnybuyer";

export const FLYER_ACQUISITION_CHANNELS = [
  "cafe_soldout",
  "cafe_extra",
  "cafe_hungover",
  "cafe_funnybuyer",
] as const satisfies readonly FlyerAcquisitionChannel[];

export const ACQUISITION_CHANNEL_LABELS: Record<AcquisitionChannel, string> = {
  qr_share: "QR share",
  qr_print: "QR print",
  ig_bio: "Instagram bio",
  manual: "Added in ops",
  friend: "Friend",
  campus: "Campus",
  other: "Other",
  cafe_soldout: "Flyer · sold out",
  cafe_extra: "Flyer · extra",
  cafe_hungover: "Flyer · hungover",
  cafe_funnybuyer: "Flyer · funny buyer",
};

export const FLYER_ACQUISITION_LABELS: Record<FlyerAcquisitionChannel, string> = {
  cafe_soldout: "Sold out",
  cafe_extra: "Extra",
  cafe_hungover: "Hungover",
  cafe_funnybuyer: "Funny buyer",
};

export const BETA_ACQUISITION_COOKIE = "passe_beta_acq";

/**
 * Last-touch: the `?src=` tag on the visit that produced a specific lead.
 *
 * Separate from `BETA_ACQUISITION_COOKIE` (first-touch, enum, first write
 * wins) because they answer different questions. First-touch says how someone
 * found us months ago; this says which link they clicked just now. For
 * per-story attribution — the same event posted twice in a week — only
 * last-touch can tell the two apart, and a returning visitor's first-touch
 * cookie would otherwise swallow every story tag.
 */
export const BETA_LAST_SRC_COOKIE = "passe_last_src";

/**
 * Story/campaign tags are free-form on purpose: a new story link shouldn't
 * need a code change or a migration. Validate the shape, store verbatim.
 *
 * Deliberately NOT routed through `explicitAcquisitionSrc` — that only knows
 * the fixed channel enum, and would drop every custom tag on the floor.
 */
const LAST_SRC_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/i;

export function parseLastSrc(src: string | null | undefined): string | null {
  const value = (src ?? "").trim();
  return LAST_SRC_RE.test(value) ? value.toLowerCase() : null;
}

const SITE = "https://mcgilltickets.party";

/**
 * Every landing now points at the apex — `/member` and `/go` were merged into
 * one app. Codes already printed on flyers keep working: those paths redirect
 * (next.config.ts) and the proxy stamps `?src=` before the redirect, so their
 * attribution is unchanged. Only newly generated QR images use these URLs.
 */
export const ACQUISITION_LANDING = {
  /** Branded /qr share screen — QR encodes this. */
  qr_share: `${SITE}/?src=qr_share`,
  /** Plain printable QR. */
  qr_print: `${SITE}/?src=qr_print`,
  /** Branded /qr/go share screen. */
  go_qr_share: `${SITE}/?src=qr_share`,
  /** Plain printable QR, /qr/go variant. */
  go_qr_print: `${SITE}/?src=qr_print`,
  /** Instagram bio — clean apex URL, no query string. */
  ig_bio: SITE,
  cafe_soldout: `${SITE}/?src=cafe_soldout`,
  cafe_extra: `${SITE}/?src=cafe_extra`,
  cafe_hungover: `${SITE}/?src=cafe_hungover`,
  cafe_funnybuyer: `${SITE}/?src=cafe_funnybuyer`,
} as const;

export function flyerLandingUrl(channel: FlyerAcquisitionChannel): string {
  return ACQUISITION_LANDING[channel];
}

export function isFlyerAcquisitionChannel(
  value: string | undefined | null,
): value is FlyerAcquisitionChannel {
  return (FLYER_ACQUISITION_CHANNELS as readonly string[]).includes(value ?? "");
}

/** The channel a `?src=` explicitly names, or null when it names none. */
export function explicitAcquisitionSrc(
  src: string | null | undefined,
): AcquisitionChannel | null {
  return src && (URL_ACQUISITION_CHANNELS as readonly string[]).includes(src)
    ? (src as AcquisitionChannel)
    : null;
}

/**
 * Did this visit come through Instagram, with no `?src=` to tell us?
 *
 * This is what lets the bare apex — the clean URL in the bio, no query string
 * — attribute itself. Two signals:
 *
 * - Instagram's in-app browser puts `Instagram` in the User-Agent. This is the
 *   default for a bio-link tap and covers the large majority.
 * - Bio links are wrapped through `l.instagram.com`, so when the tap escapes
 *   to the system browser the referrer often still names Instagram.
 *
 * Neither is guaranteed: a visitor with "open links in default browser" on,
 * and a referrer stripped along the way, reads as untagged. That's a false
 * negative, not a wrong answer — it lands in `other` rather than claiming to
 * be a bio click. If you need certainty for a campaign, tag the link.
 */
export function looksLikeInstagram(
  userAgent: string | null | undefined,
  referer: string | null | undefined,
): boolean {
  if (/instagram/i.test(userAgent ?? "")) return true;
  try {
    const host = new URL(referer ?? "").hostname.toLowerCase();
    return host === "instagram.com" || host.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

export function isAcquisitionChannel(value: string | undefined | null): value is AcquisitionChannel {
  return (ACQUISITION_CHANNELS as readonly string[]).includes(value ?? "");
}
