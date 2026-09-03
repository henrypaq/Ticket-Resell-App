"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/domains/admin/guard";
import {
  approveEvent,
  flagListing,
  refundPayment,
  rejectEvent,
  releasePayment,
  removeListing,
  unflagListing,
} from "@/domains/admin/service";

export type AdminFormState = { error?: string; message?: string };
const uuid = z.string().uuid();

export async function approveEventAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const eventId = uuid.parse(formData.get("eventId"));
  const makeResaleEnabled = formData.get("resaleEnabled") === "true";
  const note = String(formData.get("note") ?? "").trim() || undefined;

  const result = await approveEvent(admin.id, eventId, { makeResaleEnabled, note });
  revalidatePath("/admin/events");
  return result.ok ? { message: result.message } : { error: result.error };
}

export async function rejectEventAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const eventId = uuid.parse(formData.get("eventId"));
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Give a reason so the submitter knows why." };

  const result = await rejectEvent(admin.id, eventId, note);
  revalidatePath("/admin/events");
  return result.ok ? { message: result.message } : { error: result.error };
}

export async function flagListingAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const listingId = uuid.parse(formData.get("listingId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason for the flag." };

  const result = await flagListing(admin.id, listingId, reason);
  revalidatePath("/admin/listings");
  return result.ok ? { message: result.message } : { error: result.error };
}

export async function unflagListingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const listingId = uuid.parse(formData.get("listingId"));
  await unflagListing(admin.id, listingId);
  revalidatePath("/admin/listings");
}

export async function removeListingAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const listingId = uuid.parse(formData.get("listingId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Give a reason — the seller sees this." };

  const result = await removeListing(admin.id, listingId, reason);
  revalidatePath("/admin/listings");
  revalidatePath("/tickets");
  return result.ok ? { message: result.message } : { error: result.error };
}

export async function releasePaymentAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const transactionId = uuid.parse(formData.get("transactionId"));
  const note = String(formData.get("note") ?? "").trim() || undefined;

  const result = await releasePayment(admin.id, transactionId, note);
  revalidatePath("/admin/payments");
  return result.ok ? { message: result.message } : { error: result.error };
}

export async function refundPaymentAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const transactionId = uuid.parse(formData.get("transactionId"));
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Give a reason for the refund." };

  const result = await refundPayment(admin.id, transactionId, note);
  revalidatePath("/admin/payments");
  return result.ok ? { message: result.message } : { error: result.error };
}
