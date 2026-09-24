import { cronSecret } from "@/lib/env";
import { fail, ok } from "@/lib/api";
import { listIntegrityFindings, runIntegrityChecks } from "@/domains/data-capture/service";
import { notifyAdminsOfCriticalFindings } from "@/domains/data-capture/alerts";

export const dynamic = "force-dynamic";

/**
 * Snapshot the integrity checks (DATA_CAPTURE.md § 3.6) and email the team if
 * anything critical is outstanding. Same CRON_SECRET auth as the other sweeps.
 *
 * The findings view is always live, so this route is not what makes problems
 * detectable — it is what makes them *noticed* without anyone opening /ops.
 */
export async function GET(request: Request) {
  const secret = cronSecret();
  if (!secret) {
    return fail(503, {
      code: "cron_unconfigured",
      message: "CRON_SECRET isn't set on this environment.",
    });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail(401, { code: "unauthorized", message: "Missing or invalid cron authorization." });
  }

  const run = await runIntegrityChecks("cron");
  if (!run.ok) {
    return fail(500, { code: "integrity_run_failed", message: run.error ?? "Run failed." });
  }

  if ((run.critical ?? 0) > 0) {
    const findings = await listIntegrityFindings();
    await notifyAdminsOfCriticalFindings(findings, { runId: run.runId, source: "cron" });
  }

  return ok({
    runId: run.runId,
    findings: run.findings,
    critical: run.critical,
    warning: run.warning,
    info: run.info,
  });
}
