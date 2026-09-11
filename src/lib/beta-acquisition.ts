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

const SITE = "https://mcgilltickets.party";

export const ACQUISITION_LANDING = {
  /** Branded /qr share screen — QR encodes this (member onboarding). */
  qr_share: `${SITE}/member?src=qr_share`,
  /** Plain printable QR (member onboarding). */
  qr_print: `${SITE}/member?src=qr_print`,
  /** Branded /qr/go share screen — QR encodes this (buy/sell hub). */
  go_qr_share: `${SITE}/go?src=qr_share`,
  /** Plain printable /go QR. */
  go_qr_print: `${SITE}/go?src=qr_print`,
  /** Instagram bio — clean apex URL; `/` redirects to `/go`. */
  ig_bio: SITE,
  cafe_soldout: `${SITE}/go?src=cafe_soldout`,
  cafe_extra: `${SITE}/go?src=cafe_extra`,
  cafe_hungover: `${SITE}/go?src=cafe_hungover`,
  cafe_funnybuyer: `${SITE}/go?src=cafe_funnybuyer`,
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
