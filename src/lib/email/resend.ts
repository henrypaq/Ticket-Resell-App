import "server-only";

import {
  resendApiKey,
  resendConfigured,
  resendFromEmail,
} from "@/lib/env";

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; skipped?: boolean };

/**
 * Sends one email via Resend. No-ops with `{ skipped: true }` when Resend
 * isn't configured so callers can fire-and-forget without breaking UX.
 */
export async function sendEmail(args: {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}): Promise<SendEmailResult> {
  if (!resendConfigured()) {
    return { ok: false, error: "Resend is not configured.", skipped: true };
  }

  const to = Array.isArray(args.to) ? args.to : [args.to];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail(),
        to,
        subject: args.subject,
        text: args.text,
        html: args.html,
      }),
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => null)) as {
      id?: string;
      message?: string;
      name?: string;
    } | null;

    if (!res.ok) {
      return {
        ok: false,
        error: json?.message ?? json?.name ?? `Resend HTTP ${res.status}`,
      };
    }

    return { ok: true, id: json?.id ?? "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
