/**
 * Ops transaction alert emails — copy builders only.
 * Wired: buyer payment-declared → notifyOpsBuyerPaymentDeclared.
 * Seller ticket-declared stays unwired (ops only wants checkout + listing).
 */

export type OpsPaymentDeclaredEmailData = {
  offerId: string;
  eventName: string;
  priceEach: number;
  memoHint: string;
  buyerName: string | null;
  buyerPhone: string | null;
  buyerInstagram: string | null;
  opsUrl: string;
};

export type OpsFixedPriceDeclaredEmailData = {
  leadId: string;
  eventName: string;
  quantity: number;
  /** Total the buyer says they sent, all in. */
  amount: number;
  memoHint: string;
  declaredAt: string;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  buyerInstagram: string | null;
  /** Deep link to this row on the ops Transactions board. */
  transactionUrl: string;
};

export type OpsSellerTicketDeclaredEmailData = {
  sellLeadId: string;
  eventName: string;
  quantity: number;
  askEach: number | null;
  sellerName: string | null;
  sellerPhone: string | null;
  sellerInstagram: string | null;
  sellerEmail: string | null;
  opsUrl: string;
};

export function opsPaymentDeclaredSubject(data: OpsPaymentDeclaredEmailData): string {
  return `[ops] Payment claimed — ${data.eventName} · ${data.memoHint}`;
}

export function opsPaymentDeclaredText(data: OpsPaymentDeclaredEmailData): string {
  return [
    "A buyer says they sent Interac for a held ticket.",
    "",
    `Event: ${data.eventName}`,
    `Amount: $${data.priceEach.toFixed(2)} CAD`,
    `Memo: ${data.memoHint}`,
    `Buyer: ${data.buyerName || "—"}`,
    `Phone: ${data.buyerPhone || "—"}`,
    `Instagram: ${data.buyerInstagram ? `@${data.buyerInstagram}` : "—"}`,
    "",
    `Verify in ops: ${data.opsUrl}`,
    `Offer: ${data.offerId}`,
    "",
    "— mcgill.tickets ops alert",
  ].join("\n");
}

export function opsPaymentDeclaredHtml(data: OpsPaymentDeclaredEmailData): string {
  return opsAlertShell({
    badge: "PAYMENT",
    badgeColor: "#fbbf24",
    headline: "Buyer says Interac is sent",
    rows: [
      { label: "Event", value: data.eventName },
      { label: "Amount", value: `$${data.priceEach.toFixed(2)} CAD` },
      { label: "Memo", value: data.memoHint },
      { label: "Buyer", value: data.buyerName || "—" },
      { label: "Phone", value: data.buyerPhone || "—" },
      { label: "Instagram", value: data.buyerInstagram ? `@${data.buyerInstagram}` : "—" },
    ],
    ctaLabel: "Open Transactions",
    ctaUrl: data.opsUrl,
    footerId: data.offerId,
  });
}

export function opsSellerTicketDeclaredSubject(data: OpsSellerTicketDeclaredEmailData): string {
  return `[ops] Ticket transferred — ${data.eventName} · ${data.sellerName || data.sellLeadId.slice(0, 8)}`;
}

export function opsSellerTicketDeclaredText(data: OpsSellerTicketDeclaredEmailData): string {
  return [
    "A seller says they transferred a ticket to platform custody.",
    "",
    `Event: ${data.eventName}`,
    `Qty: ×${data.quantity}`,
    data.askEach != null ? `Ask: $${data.askEach.toFixed(2)} each` : "Ask: —",
    `Seller: ${data.sellerName || "—"}`,
    `Phone: ${data.sellerPhone || "—"}`,
    `Email: ${data.sellerEmail || "—"}`,
    `Instagram: ${data.sellerInstagram ? `@${data.sellerInstagram}` : "—"}`,
    "",
    `Verify in ops: ${data.opsUrl}`,
    `Lead: ${data.sellLeadId}`,
    "",
    "— mcgill.tickets ops alert",
  ].join("\n");
}

export function opsSellerTicketDeclaredHtml(data: OpsSellerTicketDeclaredEmailData): string {
  return opsAlertShell({
    badge: "TICKET IN",
    badgeColor: "#6ee1ff",
    headline: "Seller says the ticket is transferred",
    rows: [
      { label: "Event", value: data.eventName },
      { label: "Quantity", value: `×${data.quantity}` },
      {
        label: "Ask",
        value: data.askEach != null ? `$${data.askEach.toFixed(2)} each` : "—",
      },
      { label: "Seller", value: data.sellerName || "—" },
      { label: "Phone", value: data.sellerPhone || "—" },
      { label: "Email", value: data.sellerEmail || "—" },
      {
        label: "Instagram",
        value: data.sellerInstagram ? `@${data.sellerInstagram}` : "—",
      },
    ],
    ctaLabel: "Open Transactions",
    ctaUrl: data.opsUrl,
    footerId: data.sellLeadId,
  });
}

function opsAlertShell(args: {
  badge: string;
  badgeColor: string;
  headline: string;
  rows: { label: string; value: string }[];
  ctaLabel: string;
  ctaUrl: string;
  footerId: string;
}): string {
  const rowHtml = args.rows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2e;color:#9a9a9e;font-size:13px;width:120px;vertical-align:top;">${escapeHtml(r.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2e;color:#f5f5f5;font-size:14px;font-weight:600;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0b0b0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <p style="margin:0 0 8px;color:#fbbf24;font-size:14px;font-weight:700;">mcgill.tickets ops</p>
    <div style="margin:16px 0 8px;">
      <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${args.badgeColor};color:#111;font-size:12px;font-weight:700;letter-spacing:0.02em;">${escapeHtml(args.badge)}</span>
    </div>
    <h1 style="margin:0 0 24px;color:#f5f5f5;font-size:22px;line-height:1.25;font-weight:600;">${escapeHtml(args.headline)}</h1>
    <table style="width:100%;border-collapse:collapse;">${rowHtml}</table>
    <p style="margin:28px 0 0;">
      <a href="${escapeHtml(args.ctaUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#fbbf24;color:#111;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(args.ctaLabel)}</a>
    </p>
    <p style="margin:20px 0 0;color:#9a9a9e;font-size:12px;">Ref ${escapeHtml(args.footerId)}</p>
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


/**
 * Fixed-price checkout: buyer says the Interac is sent and takes their spot.
 *
 * Shouted on purpose — all caps and an emoji, because this one lands in a
 * personal inbox alongside everything else and someone has to notice it while
 * the buyer is standing there waiting.
 */
export function opsFixedPriceDeclaredSubject(data: OpsFixedPriceDeclaredEmailData): string {
  const tickets = `${data.quantity} TICKET${data.quantity === 1 ? "" : "S"}`;
  return `🚨 E-TRANSFER SENT — $${data.amount.toFixed(2)} · ${tickets} · ${data.eventName}`.toUpperCase();
}

export function opsFixedPriceDeclaredText(data: OpsFixedPriceDeclaredEmailData): string {
  return [
    "OPEN THIS TRANSACTION:",
    data.transactionUrl,
    "",
    `Event: ${data.eventName}`,
    `Tickets: ${data.quantity}`,
    `Amount declared: $${data.amount.toFixed(2)} CAD`,
    `Interac memo: ${data.memoHint}`,
    `Buyer: ${data.buyerName || "—"}`,
    `Email: ${data.buyerEmail || "—"}`,
    `Phone: ${data.buyerPhone || "—"}`,
    `Instagram: ${data.buyerInstagram ? `@${data.buyerInstagram}` : "—"}`,
    `Declared: ${formatMontreal(data.declaredAt)}`,
    "",
    `Ref ${data.leadId}`,
    "",
    "— mcgill.tickets ops alert",
  ].join("\n");
}

export function opsFixedPriceDeclaredHtml(data: OpsFixedPriceDeclaredEmailData): string {
  const rows: { label: string; value: string }[] = [
    { label: "Event", value: data.eventName },
    { label: "Tickets", value: String(data.quantity) },
    { label: "Amount", value: `$${data.amount.toFixed(2)} CAD` },
    { label: "Memo", value: data.memoHint },
    { label: "Buyer", value: data.buyerName || "—" },
    { label: "Email", value: data.buyerEmail || "—" },
    { label: "Phone", value: data.buyerPhone || "—" },
    { label: "Instagram", value: data.buyerInstagram ? `@${data.buyerInstagram}` : "—" },
    { label: "Declared", value: formatMontreal(data.declaredAt) },
  ];

  const rowHtml = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2e;color:#9a9a9e;font-size:13px;width:110px;vertical-align:top;">${escapeHtml(r.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #2a2a2e;color:#f5f5f5;font-size:14px;font-weight:600;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");

  // Button first and alone — the only thing to act on is opening the
  // transaction; the numbers below are for confirming it once you are there.
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0b0b0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <a href="${escapeHtml(data.transactionUrl)}" style="display:block;padding:20px 18px;border-radius:14px;background:#fbbf24;color:#111;font-size:18px;font-weight:800;letter-spacing:0.01em;text-align:center;text-decoration:none;">OPEN THIS TRANSACTION →</a>
    <table style="width:100%;border-collapse:collapse;margin-top:28px;">${rowHtml}</table>
    <p style="margin:20px 0 0;color:#9a9a9e;font-size:12px;">Ref ${escapeHtml(data.leadId)}</p>
  </div>
</body>
</html>`;
}

/** Montreal time — the only clock ops thinks in. */
function formatMontreal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
