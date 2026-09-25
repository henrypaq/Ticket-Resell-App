/**
 * Ops transaction notification hooks — email only.
 *
 * Ops inbox gets alerts for:
 * 1. Buyer declared Interac sent (checkout / top-of-waitlist payment)
 * 2. Seller posted a ticket (handled via notifyAdminsOfQuickLead sell path)
 * 3. Fixed-price buyer declared Interac sent while joining the queue — goes to
 *    opsTransactionAlertEmails (the people who move the money), not the
 *    general admin firehose
 */

import { sendEmail } from "@/lib/email/resend";
import { adminAlertEmails, opsTransactionAlertEmails } from "@/lib/env";
import type {
  OpsFixedPriceDeclaredEmailData,
  OpsPaymentDeclaredEmailData,
} from "@/lib/email/ops-transaction-templates";
import {
  opsFixedPriceDeclaredHtml,
  opsFixedPriceDeclaredSubject,
  opsFixedPriceDeclaredText,
  opsPaymentDeclaredHtml,
  opsPaymentDeclaredSubject,
  opsPaymentDeclaredText,
} from "@/lib/email/ops-transaction-templates";

export function buildBuyerPaymentDeclaredAlert(data: OpsPaymentDeclaredEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: opsPaymentDeclaredSubject(data),
    text: opsPaymentDeclaredText(data),
    html: opsPaymentDeclaredHtml(data),
  };
}

/** Email ops when a buyer taps “I’ve sent the money”. */
export async function notifyOpsBuyerPaymentDeclared(
  data: OpsPaymentDeclaredEmailData,
): Promise<void> {
  const to = adminAlertEmails();
  if (to.length === 0) return;
  const copy = buildBuyerPaymentDeclaredAlert(data);
  await sendEmail({
    to,
    subject: copy.subject,
    text: copy.text,
    html: copy.html,
  });
}


export function buildFixedPriceDeclaredAlert(data: OpsFixedPriceDeclaredEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: opsFixedPriceDeclaredSubject(data),
    text: opsFixedPriceDeclaredText(data),
    html: opsFixedPriceDeclaredHtml(data),
  };
}

/**
 * Email ops the moment a predetermined-price buyer says the Interac is sent.
 *
 * Fail-open and never awaited by the checkout path: a buyer who paid must keep
 * their queue spot even if Resend is down. A failure is logged, not thrown.
 */
export async function notifyOpsFixedPricePaymentDeclared(
  data: OpsFixedPriceDeclaredEmailData,
): Promise<void> {
  const to = opsTransactionAlertEmails();
  if (to.length === 0) return;
  const copy = buildFixedPriceDeclaredAlert(data);
  try {
    const result = await sendEmail({ to, ...copy });
    if (!result.ok && !result.skipped) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "ops_fixed_price_alert_failed",
          leadId: data.leadId,
          error: result.error,
        }),
      );
    }
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "ops_fixed_price_alert_threw",
        leadId: data.leadId,
        error: String(err),
      }),
    );
  }
}
