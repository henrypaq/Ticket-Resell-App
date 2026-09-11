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
