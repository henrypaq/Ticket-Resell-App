"use server";

import { redirect } from "next/navigation";
import { loginBetaOps, logoutBetaOps, requireBetaOpsSession } from "@/domains/beta-ops/auth";
import { LEAD_STATUSES, type LeadStatus } from "@/domains/beta-ops/shared";
import {
  addClassicMember,
  deleteClassicMember,
  deleteClassicWaitlistInterest,
  deleteQuickLead,
  setQueueFakeFront,
  updateQuickLead,
} from "@/domains/beta-ops/service";

export type OpsLoginState = { error?: string };

export async function betaOpsLoginAction(
  _prev: OpsLoginState,
  formData: FormData,
): Promise<OpsLoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await loginBetaOps(email, password);
  if (!result.ok) return { error: result.error };
  redirect("/ops");
}

export async function betaOpsLogoutAction(): Promise<void> {
  await logoutBetaOps();
  redirect("/ops/login");
}

export type OpsActionState = { ok?: true; error?: string };

export async function updateLeadStatusAction(
  leadId: string,
  status: LeadStatus,
): Promise<OpsActionState> {
  try {
    await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }
  if (!LEAD_STATUSES.includes(status)) return { error: "Invalid status." };
  const result = await updateQuickLead({ id: leadId, status });
  if (!result.ok) return { error: result.error };
  return { ok: true };
}

export async function updateLeadNotesAction(
  _prev: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }
  const id = String(formData.get("id") ?? "");
  const adminNotes = String(formData.get("adminNotes") ?? "");
  const result = await updateQuickLead({ id, adminNotes });
  if (!result.ok) return { error: result.error };
  return { ok: true };
}

export async function addMemberAction(
  _prev: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }

  const result = await addClassicMember({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    intent: String(formData.get("intent") ?? "both") as "buy" | "sell" | "both",
    acquisitionChannel: String(formData.get("acquisitionChannel") ?? "manual") as
      | "qr_share"
      | "qr_print"
      | "ig_bio"
      | "manual"
      | "friend"
      | "campus"
      | "other",
    referralSource: String(formData.get("referralSource") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!result.ok) return { error: result.error };
  return { ok: true };
}

export async function setFakeFrontAction(
  _prev: OpsActionState,
  formData: FormData,
): Promise<OpsActionState> {
  try {
    await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }

  const result = await setQueueFakeFront({
    eventSlug: String(formData.get("eventSlug") ?? ""),
    fakeFront: Number(formData.get("fakeFront") ?? 0),
  });

  if (!result.ok) return { error: result.error };
  return { ok: true };
}

export async function deleteMemberAction(signupId: string): Promise<OpsActionState> {
  try {
    await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }
  const result = await deleteClassicMember(signupId);
  if (!result.ok) return { error: result.error };
  return { ok: true };
}

export async function deleteWaitlistEntryAction(
  source: "classic" | "go",
  id: string,
): Promise<OpsActionState> {
  try {
    await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }
  const result =
    source === "classic"
      ? await deleteClassicWaitlistInterest(id)
      : await deleteQuickLead(id);
  if (!result.ok) return { error: result.error };
  return { ok: true };
}

export async function deleteLeadAction(leadId: string): Promise<OpsActionState> {
  try {
    await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }
  const result = await deleteQuickLead(leadId);
  if (!result.ok) return { error: result.error };
  return { ok: true };
}
