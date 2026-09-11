/**
 * First-touch acquisition for the public beta landing.
 *
 * Instagram bio uses the clean apex URL (no query string). QR codes always
 * append `?src=qr_share` or `?src=qr_print`, so a bare visit is attributed to
 * `ig_bio`. First cookie write wins — later links don't overwrite.
 */

export const ACQUISITION_CHANNELS = ["qr_share", "qr_print", "ig_bio"] as const;

export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number];

export const BETA_ACQUISITION_COOKIE = "passe_beta_acq";

export const ACQUISITION_LANDING = {
  /** Branded /qr share screen — QR encodes this. */
  qr_share: "https://mcgilltickets.party/?src=qr_share",
  /** Plain printable QR. */
  qr_print: "https://mcgilltickets.party/?src=qr_print",
  /** Instagram bio — clean URL, no query. */
  ig_bio: "https://mcgilltickets.party/go",
} as const;

export function parseAcquisitionSrc(src: string | null | undefined): AcquisitionChannel {
  if (src === "qr_share" || src === "qr_print") return src;
  // Bare URL, missing, or unknown → Instagram bio convention.
  return "ig_bio";
}

export function isAcquisitionChannel(value: string | undefined | null): value is AcquisitionChannel {
  return value === "qr_share" || value === "qr_print" || value === "ig_bio";
}
