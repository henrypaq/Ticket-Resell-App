"use server";

import { redirect } from "next/navigation";
import { loginBetaOps, logoutBetaOps, requireBetaOpsSession } from "@/domains/beta-ops/auth";
import { LEAD_STATUSES, type LeadStatus } from "@/domains/beta-ops/shared";
import { updateQuickLead } from "@/domains/beta-ops/service";

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
