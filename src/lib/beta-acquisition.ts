/**
 * First-touch acquisition for the public beta landing.
 *
 * Instagram bio uses the clean apex URL (no query string). QR codes always
 * append `?src=…`, so a bare visit is attributed to `ig_bio`. First cookie
 * write wins — later links don't overwrite.
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
 * Deliberately NOT routed through `parseAcquisitionSrc` — that maps anything
 * outside its enum to `ig_bio`, which would quietly turn every custom tag into
 * "Instagram bio" with no error anywhere.
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

export function parseAcquisitionSrc(src: string | null | undefined): AcquisitionChannel {
  if (src && (URL_ACQUISITION_CHANNELS as readonly string[]).includes(src)) {
    return src as AcquisitionChannel;
  }
  // Bare URL, missing, or unknown → Instagram bio convention.
  return "ig_bio";
}

export function isAcquisitionChannel(value: string | undefined | null): value is AcquisitionChannel {
  return (ACQUISITION_CHANNELS as readonly string[]).includes(value ?? "");
}
