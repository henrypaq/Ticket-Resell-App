import "server-only";

import {
  twilioAccountSid,
  twilioAuthToken,
  twilioConfigured,
  twilioFromNumber,
} from "@/lib/env";

export type SendSmsResult =
  | { ok: true; sid: string }
  | { ok: false; error: string; skipped?: boolean };

/**
 * Sends one SMS via Twilio's Messages API. No-ops with `{ skipped: true }` when
 * Twilio isn't configured so callers can fire-and-forget without breaking UX.
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  if (!twilioConfigured()) {
    return { ok: false, error: "Twilio is not configured.", skipped: true };
  }

  const sid = twilioAccountSid();
  const token = twilioAuthToken();
  const from = twilioFromNumber();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
      signal: controller.signal,
    });

    const json = (await res.json().catch(() => null)) as {
      sid?: string;
      message?: string;
      error_message?: string;
    } | null;

    if (!res.ok) {
      return {
        ok: false,
        error: json?.message ?? json?.error_message ?? `Twilio HTTP ${res.status}`,
      };
    }

    return { ok: true, sid: json?.sid ?? "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
