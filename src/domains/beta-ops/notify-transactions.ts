/**
 * Ops transaction notification hooks — email only.
 *
 * Ops inbox gets alerts for:
 * 1. Buyer declared Interac sent (checkout / top-of-waitlist payment)
 * 2. Seller posted a ticket (handled via notifyAdminsOfQuickLead sell path)
 */

import { sendEmail } from "@/lib/email/resend";
import { adminAlertEmails } from "@/lib/env";
import type { OpsPaymentDeclaredEmailData } from "@/lib/email/ops-transaction-templates";
import {
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
