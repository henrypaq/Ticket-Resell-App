"use server";

import { cookies } from "next/headers";
import type { QuickWaitlistEntry } from "@/domains/beta-quick/shared";
import {
  getQuickWaitlistEntries,
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

/** Cookie of buy lead UUIDs so /go can show queue position on return visits. */
export const QUICK_BUYER_COOKIE = "passe_quick_buyer";

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

async function readAcquisitionChannel(): Promise<AcquisitionChannel | undefined> {
  const jar = await cookies();
  const value = jar.get(BETA_ACQUISITION_COOKIE)?.value;
  return isAcquisitionChannel(value) ? value : undefined;
}

async function appendQuickBuyerCookie(leadId: string): Promise<void> {
  const jar = await cookies();
  const existing = jar.get(QUICK_BUYER_COOKIE)?.value ?? "";
  const ids = existing
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.includes(leadId)) ids.push(leadId);
  jar.set(QUICK_BUYER_COOKIE, ids.slice(-20).join(","), COOKIE_BASE);
}

export async function loadQuickWaitlistForHub(): Promise<QuickWaitlistEntry[]> {
  const jar = await cookies();
  const raw = jar.get(QUICK_BUYER_COOKIE)?.value ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return getQuickWaitlistEntries(ids);
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
  await appendQuickBuyerCookie(result.id);
  return { ok: true };
}

export async function submitQuickSellAction(
  _prev: QuickActionState,
  formData: FormData,
): Promise<QuickActionState> {
  const termsOn =
    formData.get("sellerTermsAccepted") === "on" || formData.get("sellerTermsAccepted") === "1";
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
