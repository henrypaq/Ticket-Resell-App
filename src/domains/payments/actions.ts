"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/domains/users/session";
import { confirmEntry, openDispute, openDisputeSchema, startPurchase } from "./service";

export type StartPurchaseState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "ready"; clientSecret: string; transactionId: string; total: number };

export async function startPurchaseAction(
  _prev: StartPurchaseState,
  formData: FormData,
): Promise<StartPurchaseState> {
  const user = await requireSessionUser();
  const listingId = z.string().uuid().safeParse(formData.get("listingId"));
  if (!listingId.success) return { status: "error", error: "Invalid listing." };

  // One idempotency key per attempt, generated server-side so a resubmit from
  // the same click can't be replayed as two charges.
  const result = await startPurchase(
    { id: user.id },
    { listingId: listingId.data, idempotencyKey: randomUUID() },
  );

  if (!result.ok) return { status: "error", error: result.error };
  return {
    status: "ready",
    clientSecret: result.clientSecret,
    transactionId: result.transactionId,
    total: result.total,
  };
}

export type BuyerActionFormState = { error?: string; message?: string };

export async function confirmEntryAction(
  _prev: BuyerActionFormState,
  formData: FormData,
): Promise<BuyerActionFormState> {
  const user = await requireSessionUser();
  const transactionId = z.string().uuid().safeParse(formData.get("transactionId"));
  if (!transactionId.success) return { error: "Invalid transaction." };

  const result = await confirmEntry(user.id, transactionId.data);
  revalidatePath("/tickets");
  return result.ok ? { message: result.message } : { error: result.error };
}

export async function openDisputeAction(
  _prev: BuyerActionFormState,
  formData: FormData,
): Promise<BuyerActionFormState> {
  const user = await requireSessionUser();
  const parsed = openDisputeSchema.safeParse({
    transactionId: formData.get("transactionId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid report." };

  const result = await openDispute(user.id, parsed.data);
  revalidatePath("/tickets");
  return result.ok ? { message: result.message } : { error: result.error };
}
