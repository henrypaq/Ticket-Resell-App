"use server";

import { cookies } from "next/headers";
import {
  quickBuySchema,
  quickSellSchema,
  submitQuickBuy,
  submitQuickSell,
} from "@/domains/beta-quick/service";
import {
  BETA_ACQUISITION_COOKIE,
  isAcquisitionChannel,
  type AcquisitionChannel,
} from "@/lib/beta-acquisition";

export type QuickActionState = { ok?: true; error?: string };

async function readAcquisitionChannel(): Promise<AcquisitionChannel | undefined> {
  const jar = await cookies();
  const value = jar.get(BETA_ACQUISITION_COOKIE)?.value;
  return isAcquisitionChannel(value) ? value : undefined;
}

export async function submitQuickBuyAction(
  _prev: QuickActionState,
  formData: FormData,
): Promise<QuickActionState> {
  const parsed = quickBuySchema.safeParse({
    eventSlug: formData.get("eventSlug"),
    quantity: formData.get("quantity"),
    contactPhone: formData.get("contactPhone") || "",
    contactInstagram: formData.get("contactInstagram") || "",
    acquisitionChannel: await readAcquisitionChannel(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your answers and try again." };
  }
  const result = await submitQuickBuy(parsed.data);
  if (!result.ok) return { error: result.error };
  return { ok: true };
}

export async function submitQuickSellAction(
  _prev: QuickActionState,
  formData: FormData,
): Promise<QuickActionState> {
  const termsOn = formData.get("sellerTermsAccepted") === "on" || formData.get("sellerTermsAccepted") === "1";
  const parsed = quickSellSchema.safeParse({
    eventSlug: formData.get("eventSlug"),
    quantity: formData.get("quantity"),
    paidEach: formData.get("paidEach"),
    askEach: formData.get("askEach"),
    contactPhone: formData.get("contactPhone") || "",
    contactInstagram: formData.get("contactInstagram") || "",
    ticketShareUrl: formData.get("ticketShareUrl") || "",
    etransferName: formData.get("etransferName"),
    etransferEmail: formData.get("etransferEmail") || "",
    etransferPhone: formData.get("etransferPhone") || "",
    sellerTermsAccepted: termsOn ? true : false,
    acquisitionChannel: await readAcquisitionChannel(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your answers and try again." };
  }

  const raw = formData.get("ticketImage");
  let file: { bytes: Uint8Array; name: string } | null = null;
  if (raw instanceof File && raw.size > 0) {
    file = { bytes: new Uint8Array(await raw.arrayBuffer()), name: raw.name };
  }

  const result = await submitQuickSell(parsed.data, file);
  if (!result.ok) return { error: result.error };
  return { ok: true };
}
