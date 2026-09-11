"use server";

import { cookies } from "next/headers";
import { GO_CONTACT_COOKIE, getGoContactById, type GoContactProfile } from "@/domains/beta-go/contacts";
import {
  QUICK_BUYER_COOKIE,
  type QuickActionState,
  type QuickWaitlistEntry,
} from "@/domains/beta-quick/shared";
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

async function readGoContactId(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(GO_CONTACT_COOKIE)?.value;
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

async function setGoContactCookie(contactId: string): Promise<void> {
  const jar = await cookies();
  jar.set(GO_CONTACT_COOKIE, contactId, COOKIE_BASE);
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

export async function loadSavedGoContact(): Promise<GoContactProfile | null> {
  const id = await readGoContactId();
  if (!id) return null;
  return getGoContactById(id);
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
  const result = await submitQuickBuy({
    ...parsed.data,
    existingContactId: await readGoContactId(),
  });
  if (!result.ok) return { error: result.error };
  await appendQuickBuyerCookie(result.id);
  if (result.contactId) await setGoContactCookie(result.contactId);
  return { ok: true };
}

export async function submitQuickSellAction(
  _prev: QuickActionState,
  formData: FormData,
): Promise<QuickActionState> {
  try {
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

    const uploads: { bytes: Uint8Array; name: string }[] = [];
    const all = formData.getAll("ticketImage");
    for (const raw of all) {
      if (raw instanceof File && raw.size > 0) {
        uploads.push({ bytes: new Uint8Array(await raw.arrayBuffer()), name: raw.name });
      }
    }

    const result = await submitQuickSell(
      { ...parsed.data, existingContactId: await readGoContactId() },
      uploads,
    );
    if (!result.ok) return { error: result.error };
    if (result.contactId) await setGoContactCookie(result.contactId);
    return { ok: true };
  } catch (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "quick_sell_action_failed", error: String(error) }));
    return { error: "Couldn't submit. Try again in a moment." };
  }
}
