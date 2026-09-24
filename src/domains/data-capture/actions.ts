"use server";

import { requireBetaOpsSession } from "@/domains/beta-ops/auth";
import { notifyAdminsOfCriticalFindings } from "@/domains/data-capture/alerts";
import { listIntegrityFindings, recordManualEvent, runIntegrityChecks } from "@/domains/data-capture/service";

export type DataActionState = { ok?: true; error?: string; message?: string };

/** Run the integrity checks on demand from /ops/data. */
export async function runIntegrityChecksAction(): Promise<DataActionState> {
  try {
    await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }

  const run = await runIntegrityChecks("ops_console");
  if (!run.ok) return { error: run.error ?? "Run failed." };

  if ((run.critical ?? 0) > 0) {
    const findings = await listIntegrityFindings();
    await notifyAdminsOfCriticalFindings(findings, { runId: run.runId, source: "ops console" });
  }

  return {
    ok: true,
    message: `${run.findings} finding(s): ${run.critical} critical, ${run.warning} warning, ${run.info} info.`,
  };
}

/** Attach an off-app action (a DM hand-off, a manual refund) to a record. */
export async function recordManualEventAction(input: {
  subjectType: string;
  subjectId: string;
  note: string;
  eventSlug?: string | null;
  amount?: number | null;
}): Promise<DataActionState> {
  let session;
  try {
    session = await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }

  const result = await recordManualEvent({ ...input, actorLabel: session.email });
  if (!result.ok) return { error: result.error };
  return { ok: true };
}
