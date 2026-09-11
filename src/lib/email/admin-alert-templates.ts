/**
 * Admin alert email copy for beta waitlist / sell interest.
 * Kept as plain functions so the same content is used by Resend and easy to preview.
 */

export type BetaInterestEmailData = {
  intent: "waitlist" | "sell";
  eventLabel: string;
  personName: string;
  personEmail: string;
  personPhone?: string | null;
  waitlistPosition?: number;
  contactPhone?: string;
  contactInstagram?: string;
};

export function betaInterestEmailSubject(data: BetaInterestEmailData): string {
  if (data.intent === "waitlist") {
    const pos = data.waitlistPosition != null ? ` (#${data.waitlistPosition})` : "";
    return `[waitlist] ${data.eventLabel}${pos} — ${data.personName}`;
  }
  return `[sell] ${data.eventLabel} — ${data.personName}`;
}

export function betaInterestEmailText(data: BetaInterestEmailData): string {
  const lines: string[] = [
    data.intent === "waitlist"
      ? "Someone joined a beta waitlist."
      : "Someone confirmed they have a ticket to sell.",
    "",
    `Event: ${data.eventLabel}`,
    `Name: ${data.personName}`,
    `Email: ${data.personEmail}`,
  ];

  if (data.personPhone) {
    lines.push(`Signup phone: ${data.personPhone}`);
  }

  if (data.intent === "waitlist" && data.waitlistPosition != null) {
    lines.push(`Waitlist position: #${data.waitlistPosition}`);
  }

  if (data.intent === "sell") {
    lines.push(`WhatsApp: ${data.contactPhone || "—"}`);
    lines.push(`Instagram: ${data.contactInstagram ? `@${data.contactInstagram}` : "—"}`);
  }

  lines.push("", "— mcgill.tickets admin alert");
  return lines.join("\n");
}

export function betaInterestEmailHtml(data: BetaInterestEmailData): string {
  const badge =
    data.intent === "waitlist"
      ? `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#fff3a0;color:#111;font-size:12px;font-weight:700;letter-spacing:0.02em;">WAITLIST</span>`
      : `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#6ee1ff;color:#111;font-size:12px;font-weight:700;letter-spacing:0.02em;">SELL</span>`;

  const headline =
    data.intent === "waitlist"
      ? "Joined the waitlist"
      : "Confirmed a ticket to sell";

  const rows: { label: string; value: string }[] = [
    { label: "Event", value: escapeHtml(data.eventLabel) },
    { label: "Name", value: escapeHtml(data.personName) },
    { label: "Email", value: escapeHtml(data.personEmail) },
  ];

  if (data.personPhone) {
    rows.push({ label: "Signup phone", value: escapeHtml(data.personPhone) });
  }
  if (data.intent === "waitlist" && data.waitlistPosition != null) {
    rows.push({ label: "Position", value: `#${data.waitlistPosition}` });
  }
  if (data.intent === "sell") {
    rows.push({
      label: "WhatsApp",
      value: escapeHtml(data.contactPhone || "—"),
    });
    rows.push({
      label: "Instagram",
      value: data.contactInstagram ? `@${escapeHtml(data.contactInstagram)}` : "—",
    });
  }

  const rowHtml = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2e;color:#9a9a9e;font-size:13px;width:120px;vertical-align:top;">${r.label}</td>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2e;color:#f5f5f5;font-size:14px;font-weight:600;">${r.value}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0b0b0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <p style="margin:0 0 8px;color:#ffe500;font-size:14px;font-weight:700;">mcgill.tickets</p>
    <div style="margin:16px 0 8px;">${badge}</div>
    <h1 style="margin:0 0 24px;color:#f5f5f5;font-size:22px;line-height:1.25;font-weight:600;">${headline}</h1>
    <table style="width:100%;border-collapse:collapse;">${rowHtml}</table>
    <p style="margin:28px 0 0;color:#9a9a9e;font-size:12px;">Admin alert — beta interest</p>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* —— Quick `/go` flow alerts —— */

export type QuickLeadEmailData = {
  intent: "buy" | "sell";
  eventLabel: string;
  quantity: number;
  contactPhone?: string;
  contactInstagram?: string;
  transferFirstName?: string;
  transferLastName?: string;
  transferEmail?: string;
  paidEach?: number;
  askEach?: number;
  ticketShareUrl?: string;
  hasEvidence?: boolean;
  etransferName?: string;
  etransferEmail?: string;
  etransferPhone?: string;
  leadId: string;
};

export function quickLeadEmailSubject(data: QuickLeadEmailData): string {
  const tag = data.intent === "buy" ? "need ticket" : "have ticket";
  return `[${tag}] ${data.eventLabel} ×${data.quantity}`;
}

export function quickLeadEmailText(data: QuickLeadEmailData): string {
  const lines: string[] = [
    data.intent === "buy"
      ? "Someone needs a ticket (quick /go flow)."
      : "Someone has a ticket to sell (quick /go flow).",
    "",
    `Event: ${data.eventLabel}`,
    `Quantity: ${data.quantity}`,
    `WhatsApp: ${data.contactPhone || "—"}`,
    `Instagram: ${data.contactInstagram ? `@${data.contactInstagram}` : "—"}`,
  ];
  if (data.intent === "buy" && (data.transferFirstName || data.transferLastName || data.transferEmail)) {
    const name = [data.transferFirstName, data.transferLastName].filter(Boolean).join(" ");
    lines.push(`Transfer name: ${name || "—"}`);
    lines.push(`Transfer email: ${data.transferEmail || "—"}`);
  }
  if (data.intent === "sell") {
    lines.push(`Paid: $${(data.paidEach ?? 0).toFixed(2)} each`);
    lines.push(`Asking: $${(data.askEach ?? 0).toFixed(2)} each`);
    lines.push(`Ticket link: ${data.ticketShareUrl || "—"}`);
    lines.push(`Screenshot uploaded: ${data.hasEvidence ? "yes" : "no"}`);
    lines.push(`Interac name: ${data.etransferName || "—"}`);
    lines.push(`Interac email: ${data.etransferEmail || "—"}`);
    lines.push(`Interac phone: ${data.etransferPhone || "—"}`);
  }
  lines.push("", `Lead id: ${data.leadId}`, "", "— mcgill.tickets admin alert");
  return lines.join("\n");
}

export function quickLeadEmailHtml(data: QuickLeadEmailData): string {
  const badge =
    data.intent === "buy"
      ? `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#fff3a0;color:#111;font-size:12px;font-weight:700;">NEED TICKET</span>`
      : `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#6ee1ff;color:#111;font-size:12px;font-weight:700;">HAVE TICKET</span>`;

  const rows: { label: string; value: string }[] = [
    { label: "Event", value: escapeHtml(data.eventLabel) },
    { label: "Quantity", value: String(data.quantity) },
    { label: "WhatsApp", value: escapeHtml(data.contactPhone || "—") },
    {
      label: "Instagram",
      value: data.contactInstagram ? `@${escapeHtml(data.contactInstagram)}` : "—",
    },
  ];
  if (data.intent === "buy" && (data.transferFirstName || data.transferLastName || data.transferEmail)) {
    const name = [data.transferFirstName, data.transferLastName].filter(Boolean).join(" ");
    rows.push({ label: "Transfer name", value: escapeHtml(name || "—") });
    rows.push({ label: "Transfer email", value: escapeHtml(data.transferEmail || "—") });
  }
  if (data.intent === "sell") {
    rows.push({ label: "Paid", value: `$${(data.paidEach ?? 0).toFixed(2)} each` });
    rows.push({ label: "Asking", value: `$${(data.askEach ?? 0).toFixed(2)} each` });
    rows.push({ label: "Ticket link", value: escapeHtml(data.ticketShareUrl || "—") });
    rows.push({ label: "Screenshot", value: data.hasEvidence ? "uploaded" : "none" });
    rows.push({ label: "Interac name", value: escapeHtml(data.etransferName || "—") });
    rows.push({ label: "Interac email", value: escapeHtml(data.etransferEmail || "—") });
    rows.push({ label: "Interac phone", value: escapeHtml(data.etransferPhone || "—") });
  }

  const rowHtml = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2e;color:#9a9a9e;font-size:13px;width:130px;vertical-align:top;">${r.label}</td>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2e;color:#f5f5f5;font-size:14px;font-weight:600;">${r.value}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0b0b0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <p style="margin:0 0 8px;color:#ffe500;font-size:14px;font-weight:700;">mcgill.tickets</p>
    <div style="margin:16px 0 8px;">${badge}</div>
    <h1 style="margin:0 0 24px;color:#f5f5f5;font-size:22px;line-height:1.25;font-weight:600;">Quick /go lead</h1>
    <table style="width:100%;border-collapse:collapse;">${rowHtml}</table>
    <p style="margin:28px 0 0;color:#9a9a9e;font-size:12px;">Lead ${escapeHtml(data.leadId)}</p>
  </div>
</body>
</html>`;
}
