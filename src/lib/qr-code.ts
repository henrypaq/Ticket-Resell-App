import "server-only";

import QRCode from "qrcode";

/** White modules on black — reads clean on yellow flyer stock. */
export async function invertedQrDataUrl(text: string, size = 1024): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: {
      dark: "#ffffff",
      light: "#000000",
    },
  });
}

/**
 * Black modules on brand yellow — for the on-screen event QR pages, where the
 * code sits flush on a yellow poster with no white card around it. Dark-on-
 * light is the orientation scanners are happiest with, and #fbbf24 against
 * near-black clears the contrast bar comfortably.
 */
export async function brandedQrDataUrl(text: string, size = 1400): Promise<string> {
  return QRCode.toDataURL(text, {
    // One step up from the flyer codes: these get scanned off a phone screen
    // at an angle, in a dark room, often with a fingerprint over the glass.
    errorCorrectionLevel: "Q",
    margin: 2,
    width: size,
    color: {
      dark: "#0b0b0c",
      light: "#fbbf24",
    },
  });
}
