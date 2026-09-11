import "server-only";

import {
  betaInterestEmailHtml,
  betaInterestEmailSubject,
  betaInterestEmailText,
  quickLeadEmailHtml,
  quickLeadEmailSubject,
  quickLeadEmailText,
  type BetaInterestEmailData,
  type QuickLeadEmailData,
} from "@/lib/email/admin-alert-templates";
import { sendEmail } from "@/lib/email/resend";
import { adminAlertEmails, resendConfigured } from "@/lib/env";
import { betaEventBySlug } from "@/lib/beta-events";
import { createAdminClient } from "@/lib/supabase/admin";

export type BetaInterestAlertInput = {
  signupId: string;
  eventSlug: string;
  intent: "waitlist" | "sell";
  contactPhone?: string;
  contactInstagram?: string;
  waitlistPosition?: number;
};

export type QuickLeadAlertInput = {
  id: string;
  intent: "buy" | "sell";
  eventSlug: string;
  quantity: number;
  contactPhone?: string;
  contactInstagram?: string;
  paidEach?: number;
  askEach?: number;
  ticketShareUrl?: string;
  hasEvidence?: boolean;
  etransferName?: string;
  etransferEmail?: string;
  etransferPhone?: string;
};

/**
 * Emails `ADMIN_ALERT_EMAIL` (default wrymage@gmail.com) when someone joins a
 * beta waitlist or confirms a ticket to sell. Fail-open: never throws.
 */
export async function notifyAdminsOfBetaInterest(input: BetaInterestAlertInput): Promise<void> {
  if (!resendConfigured()) {
    console.info(
      JSON.stringify({
        level: "info",
        msg: "admin_email_skipped_unconfigured",
        intent: input.intent,
        eventSlug: input.eventSlug,
      }),
    );
    return;
  }

  const recipients = adminAlertEmails();
  if (recipients.length === 0) return;

  const data = await loadEmailData(input);
  if (!data) return;

  const result = await sendEmail({
    to: recipients,
    subject: betaInterestEmailSubject(data),
    text: betaInterestEmailText(data),
    html: betaInterestEmailHtml(data),
  });

  if (result.ok) {
    console.info(
      JSON.stringify({
        level: "info",
        msg: "admin_email_sent",
        id: result.id,
        intent: input.intent,
        eventSlug: input.eventSlug,
        to: recipients,
      }),
    );
  } else if (!result.skipped) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "admin_email_failed",
        error: result.error,
        intent: input.intent,
        eventSlug: input.eventSlug,
      }),
    );
  }
}

/** Admin email for the low-friction `/go` buy/sell flow. */
export async function notifyAdminsOfQuickLead(input: QuickLeadAlertInput): Promise<void> {
  if (!resendConfigured()) {
    console.info(
      JSON.stringify({
        level: "info",
        msg: "admin_email_skipped_unconfigured",
        source: "quick",
        intent: input.intent,
        eventSlug: input.eventSlug,
      }),
    );
    return;
  }

  const recipients = adminAlertEmails();
  if (recipients.length === 0) return;

  const event = betaEventBySlug(input.eventSlug);
  const data: QuickLeadEmailData = {
    intent: input.intent,
    eventLabel: event?.name ?? input.eventSlug,
    quantity: input.quantity,
    contactPhone: input.contactPhone,
    contactInstagram: input.contactInstagram,
    paidEach: input.paidEach,
    askEach: input.askEach,
    ticketShareUrl: input.ticketShareUrl,
    hasEvidence: input.hasEvidence,
    etransferName: input.etransferName,
    etransferEmail: input.etransferEmail,
    etransferPhone: input.etransferPhone,
    leadId: input.id,
  };

  const result = await sendEmail({
    to: recipients,
    subject: quickLeadEmailSubject(data),
    text: quickLeadEmailText(data),
    html: quickLeadEmailHtml(data),
  });

  if (result.ok) {
    console.info(
      JSON.stringify({
        level: "info",
        msg: "admin_email_sent",
        source: "quick",
        id: result.id,
        intent: input.intent,
        eventSlug: input.eventSlug,
      }),
    );
  } else if (!result.skipped) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "admin_email_failed",
        source: "quick",
        error: result.error,
        intent: input.intent,
        eventSlug: input.eventSlug,
      }),
    );
  }
}

async function loadEmailData(
  input: BetaInterestAlertInput,
): Promise<BetaInterestEmailData | null> {
  const event = betaEventBySlug(input.eventSlug);
  const eventLabel = event?.name ?? input.eventSlug;

  const admin = createAdminClient();
  const { data: signup } = await admin
    .from("beta_members")
    .select("name, email, phone")
    .eq("id", input.signupId)
    .maybeSingle();

  return {
    intent: input.intent,
    eventLabel,
    personName: signup?.name?.trim() || "Someone",
    personEmail: signup?.email || `(unknown · ${input.signupId.slice(0, 8)})`,
    personPhone: signup?.phone ?? null,
    waitlistPosition: input.waitlistPosition,
    contactPhone: input.contactPhone,
    contactInstagram: input.contactInstagram,
  };
}
