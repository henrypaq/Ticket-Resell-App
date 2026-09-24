import "server-only";

import { sendEmail } from "@/lib/email/resend";
import { adminAlertEmails, resendConfigured } from "@/lib/env";
import { alertableFindings, describeFinding, type IntegrityFinding } from "@/domains/data-capture/shared";

/**
 * Email the team when an integrity run turns up something critical.
 *
 * Fail-open, like every other alert in this codebase: a check that found a
 * problem must still record it even if the mail never sends.
 */
export async function notifyAdminsOfCriticalFindings(
  findings: IntegrityFinding[],
  context: { runId?: string; source: string },
): Promise<void> {
  const critical = alertableFindings(findings);
  if (critical.length === 0) return;

  if (!resendConfigured()) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "integrity_alert_skipped_unconfigured",
        critical: critical.length,
        checks: [...new Set(critical.map((f) => f.checkName))],
        runId: context.runId,
      }),
    );
    return;
  }

  const lines = critical.slice(0, 20).map((f) => {
    const { title, action } = describeFinding(f.checkName);
    const subject = f.subjectLabel ?? f.subjectId ?? "—";
    return `• ${title}\n  ${f.subjectType ?? "record"} ${subject}${f.eventSlug ? ` · ${f.eventSlug}` : ""}\n  → ${action}`;
  });
  const more = critical.length > lines.length ? `\n…and ${critical.length - lines.length} more.` : "";

  const text = `${critical.length} critical data-integrity finding(s) — ${context.source} run.\n\n${lines.join("\n\n")}${more}\n\nFull list: /ops/data`;
  const html = `<p><strong>${critical.length} critical data-integrity finding(s)</strong> — ${context.source} run.</p><ul>${critical
    .slice(0, 20)
    .map((f) => {
      const { title, action } = describeFinding(f.checkName);
      const subject = f.subjectLabel ?? f.subjectId ?? "—";
      return `<li><strong>${title}</strong><br/>${f.subjectType ?? "record"} ${subject}${f.eventSlug ? ` · ${f.eventSlug}` : ""}<br/><em>${action}</em></li>`;
    })
    .join("")}</ul><p>Full list in <code>/ops/data</code>.</p>`;

  try {
    await sendEmail({
      to: adminAlertEmails(),
      subject: `[data] ${critical.length} critical integrity finding(s)`,
      text,
      html,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({ level: "warn", msg: "integrity_alert_failed", error: String(err) }),
    );
  }
}
