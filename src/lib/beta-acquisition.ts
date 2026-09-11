/**
 * First-touch acquisition for the public beta landing.
 *
 * Instagram bio uses the clean apex URL (no query string). QR codes always
 * append `?src=qr_share` or `?src=qr_print`, so a bare visit is attributed to
 * `ig_bio`. First cookie write wins — later links don't overwrite.
 */

export const ACQUISITION_CHANNELS = [
  "qr_share",
  "qr_print",
  "ig_bio",
  "manual",
  "friend",
  "campus",
  "other",
] as const;

export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number];

export const ACQUISITION_CHANNEL_LABELS: Record<AcquisitionChannel, string> = {
  qr_share: "QR share",
  qr_print: "QR print",
  ig_bio: "Instagram bio",
  manual: "Added in ops",
  friend: "Friend",
  campus: "Campus",
  other: "Other",
};

export const BETA_ACQUISITION_COOKIE = "passe_beta_acq";

export const ACQUISITION_LANDING = {
  /** Branded /qr share screen — QR encodes this (member onboarding). */
  qr_share: "https://mcgilltickets.party/member?src=qr_share",
  /** Plain printable QR (member onboarding). */
  qr_print: "https://mcgilltickets.party/member?src=qr_print",
  /** Branded /qr/go share screen — QR encodes this (buy/sell hub). */
  go_qr_share: "https://mcgilltickets.party/go?src=qr_share",
  /** Plain printable /go QR. */
  go_qr_print: "https://mcgilltickets.party/go?src=qr_print",
  /** Instagram bio — clean apex URL; `/` redirects to `/go`. */
  ig_bio: "https://mcgilltickets.party",
} as const;

export function parseAcquisitionSrc(src: string | null | undefined): AcquisitionChannel {
  if (src === "qr_share" || src === "qr_print") return src;
  // Bare URL, missing, or unknown → Instagram bio convention.
  return "ig_bio";
}

export function isAcquisitionChannel(value: string | undefined | null): value is AcquisitionChannel {
  return (ACQUISITION_CHANNELS as readonly string[]).includes(value ?? "");
}
