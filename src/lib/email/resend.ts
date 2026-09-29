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
  /** Defaults to RESEND_FROM_EMAIL. */
  from?: string;
}): Promise<SendEmailResult> {
  if (!resendConfigured()) {
    return { ok: false, error: "Resend is not configured.", skipped: true };
  }

  const primary = await post({ ...args, from: args.from ?? resendFromEmail() });
  // A custom sender on a domain Resend hasn't verified yet (e.g. the ops
  // subdomain while its DNS propagates) is refused outright — resend from the
  // main address rather than drop the email.
  if (!primary.ok && args.from && primary.unverifiedDomain) {
    console.warn(
      JSON.stringify({ level: "warn", msg: "email_sender_unverified_fallback", from: args.from }),
    );
    return strip(await post({ ...args, from: resendFromEmail() }));
  }
  return strip(primary);
}

type PostResult = SendEmailResult & { unverifiedDomain?: boolean };

function strip(result: PostResult): SendEmailResult {
  if (result.ok) return result;
  return { ok: false, error: result.error, ...(result.skipped ? { skipped: true } : {}) };
}

async function post(args: {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  from: string;
}): Promise<PostResult> {
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
        from: args.from,
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
      const error = json?.message ?? json?.name ?? `Resend HTTP ${res.status}`;
      return {
        ok: false,
        error,
        unverifiedDomain: res.status === 403 && /domain is not verified/i.test(error),
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
