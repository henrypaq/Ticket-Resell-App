/**
 * Ops inbox alerts — the dark, event-first set: new listing, new waitlist
 * seat, a match that needs someone to step in, a resale buyer saying their
 * Interac is sent, and a fixed-price order whose Interac needs confirming.
 *
 * One shell for all of them so they read as a family at a glance: the event's
 * flyer fading into black up top (like the event pages) with the event named
 * small in the corner, a large title saying what happened, then shadcn-style
 * cards of label/value rows — all in one sans face (Geist, shadcn's default).
 * Email clients can't run React, so the "components" are inline-styled tables
 * using the app's tokens (CLAUDE_SPECS/STYLE.md): base #0B0B0C, card #17171A,
 * hairline #2A2A2E, text #F5F5F5 / #9A9A9E, amber only for "act now".
 *
 * Deliberately import-free so a preview script can render it without the app.
 */

export type OpsAlertEvent = {
  name: string;
  /** e.g. "Thu · Café Campus" */
  meta?: string | null;
  /** Absolute URL; the header falls back to a flat card color without it. */
  flyerUrl?: string | null;
};

export type OpsAlertContent = { subject: string; preheader: string; text: string; html: string };

type Tone = "info" | "action";

type Row = { label: string; value: string | null | undefined; href?: string | null; mono?: boolean };
type Section = { title: string; rows: Row[] };
type Cta = { label: string; url: string };

const C = {
  base: "#0B0B0C",
  card: "#17171A",
  hairline: "#2A2A2E",
  text: "#F5F5F5",
  muted: "#9A9A9E",
  faint: "#6B6B70",
  amber: "#F5A623",
};

const SANS = "Geist, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Safe inside CSS `url('…')` within a double-quoted style attribute. Quotes are
 * percent-encoded rather than entity-escaped: the HTML parser decodes `&#39;`
 * back to `'` before CSS ever sees it.
 */
function cssUrl(url: string): string {
  return url
    .replace(/['"()\\\s<>]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`)
    .replace(/&/g, "&amp;");
}

function money(n: number | null | undefined): string | null {
  return n == null || !Number.isFinite(n) ? null : `$${n.toFixed(2)}`;
}

function tickets(n: number): string {
  return n === 1 ? "1 ticket" : `${n} tickets`;
}

function handle(ig: string | null | undefined): string | null {
  const h = ig?.trim().replace(/^@+/, "");
  return h ? `@${h}` : null;
}

export function formatMontreal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // en-US, not en-CA: "2:26 PM" reads cleaner than "2:26 p.m." mid-sentence.
  return d.toLocaleString("en-US", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* —— Shell —— */

function hero(event: OpsAlertEvent): string {
  const raw = event.flyerUrl?.trim();
  const flyer = raw && /^https?:\/\//i.test(raw) ? raw : null;
  const bg = flyer
    ? `background-color:${C.card};background-image:linear-gradient(180deg,rgba(11,11,12,0.55) 0%,rgba(11,11,12,0.3) 35%,rgba(11,11,12,0.8) 78%,${C.base} 100%),url('${cssUrl(flyer)}');background-size:cover;background-position:center;`
    : `background-color:${C.card};background-image:linear-gradient(180deg,${C.card} 0%,${C.base} 100%);`;
  const meta = event.meta?.trim()
    ? `<div style="margin-top:3px;font-family:${SANS};font-size:12px;line-height:1.4;color:rgba(245,245,245,0.7);">${esc(event.meta.trim())}</div>`
    : "";
  return `
<tr><td ${flyer ? `background="${esc(flyer)}" ` : ""}bgcolor="${C.card}" style="${bg}border-radius:16px 16px 0 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="height:176px;">
    <tr><td valign="top" align="right" style="padding:18px 22px 0;">
      <div style="font-family:${SANS};font-size:14px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:#FFFFFF;">${esc(event.name)}</div>
      ${meta}
    </td></tr>
  </table>
</td></tr>`;
}

function callout(text: string, tone: Tone): string {
  const urgent = tone === "action";
  const border = urgent ? "rgba(245,166,35,0.45)" : C.hairline;
  const fill = urgent ? "rgba(245,166,35,0.08)" : C.card;
  const label = urgent ? "Next step" : "Heads up";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border-collapse:separate;">
  <tr><td style="padding:14px 16px;background:${fill};border:1px solid ${border};border-radius:12px;">
    <div style="font-family:${SANS};font-size:13px;font-weight:600;line-height:1.3;color:${urgent ? C.amber : C.muted};">${label}</div>
    <div style="margin-top:4px;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.text};">${esc(text)}</div>
  </td></tr>
</table>`;
}

function card(section: Section): string {
  const rows = section.rows.filter((r) => r.value != null && String(r.value).trim() !== "");
  if (rows.length === 0) return "";
  const body = rows
    .map((r, i) => {
      const raw = esc(String(r.value));
      const inner = r.href
        ? `<a href="${esc(r.href)}" style="color:${C.text};text-decoration:underline;text-decoration-color:${C.faint};">${raw}</a>`
        : raw;
      const font = `font-family:${SANS};font-size:${r.mono ? 12 : 14}px;${r.mono ? "letter-spacing:0.01em;" : ""}`;
      const divider = i === 0 ? "" : `border-top:1px solid ${C.hairline};`;
      return `<tr>
        <td valign="top" style="${divider}padding:11px 0 11px 20px;width:38%;font-family:${SANS};font-size:13px;line-height:1.45;color:${C.muted};">${esc(r.label)}</td>
        <td valign="top" align="right" style="${divider}padding:11px 20px 11px 12px;${font}line-height:1.45;color:${C.text};word-break:break-word;">${inner}</td>
      </tr>`;
    })
    .join("");
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;background:${C.card};border:1px solid ${C.hairline};border-radius:12px;border-collapse:separate;">
  <tr><td colspan="2" style="padding:16px 20px 6px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:-0.01em;color:${C.text};">${esc(section.title)}</td></tr>
  ${body}
  <tr><td colspan="2" style="height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>
</table>`;
}

function buttons(primary: Cta, secondary?: Cta | null): string {
  const base = `display:inline-block;padding:11px 16px;border-radius:8px;font-family:${SANS};font-size:14px;font-weight:500;line-height:1;text-decoration:none;`;
  const second = secondary
    ? `<a href="${esc(secondary.url)}" style="${base}margin-left:8px;border:1px solid ${C.hairline};color:${C.text};">${esc(secondary.label)}</a>`
    : "";
  return `<div style="margin:8px 0 0;"><a href="${esc(primary.url)}" style="${base}background:${C.text};color:${C.base};border:1px solid ${C.text};">${esc(primary.label)}</a>${second}</div>`;
}

function shell(args: {
  preheader: string;
  event: OpsAlertEvent;
  tone: Tone;
  title: string;
  summary: string;
  note?: string | null;
  sections: Section[];
  primary: Cta;
  secondary?: Cta | null;
  reference: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(args.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<style>:root{color-scheme:dark;}body{margin:0;padding:0;background:${C.base};}a{color:${C.text};}</style>
</head>
<body style="margin:0;padding:0;background:${C.base};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(args.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.base}" style="background:${C.base};">
<tr><td align="center" style="padding:24px 12px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;border:1px solid ${C.hairline};border-radius:17px;border-collapse:separate;background:${C.base};">
    ${hero(args.event)}
    <tr><td style="padding:24px 24px 8px;">
      <h1 style="margin:4px 0 8px;font-family:${SANS};font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.025em;color:${C.text};">${esc(args.title)}</h1>
      <p style="margin:0 0 24px;font-family:${SANS};font-size:15px;line-height:1.55;color:${C.muted};">${esc(args.summary)}</p>
      ${args.note ? callout(args.note, args.tone) : ""}
      ${args.sections.map(card).join("")}
      ${buttons(args.primary, args.secondary)}
    </td></tr>
    <tr><td style="padding:24px 24px 22px;">
      <div style="border-top:1px solid ${C.hairline};padding-top:16px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.faint};">
        mcgill.tickets ops<br>
        ${esc(args.reference)}
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function textBlock(args: {
  title: string;
  event: OpsAlertEvent;
  summary: string;
  note?: string | null;
  sections: Section[];
  links: Cta[];
  reference: string;
}): string {
  const lines = [
    args.title.toUpperCase(),
    [args.event.name, args.event.meta].filter(Boolean).join(" · "),
    "",
    args.summary,
  ];
  if (args.note) lines.push("", `Next: ${args.note}`);
  for (const s of args.sections) {
    const rows = s.rows.filter((r) => r.value != null && String(r.value).trim() !== "");
    if (rows.length === 0) continue;
    lines.push("", s.title.toUpperCase(), ...rows.map((r) => `${r.label}: ${r.value}`));
  }
  lines.push("", ...args.links.map((l) => `${l.label.replace(/\s*→$/, "")}: ${l.url}`));
  lines.push("", args.reference, "— mcgill.tickets ops alert");
  return lines.join("\n");
}

function build(args: Parameters<typeof shell>[0] & { subject: string }): OpsAlertContent {
  const links = [args.primary, ...(args.secondary ? [args.secondary] : [])];
  return {
    subject: args.subject,
    preheader: args.preheader,
    html: shell(args),
    text: textBlock({ ...args, links }),
  };
}

/* —— 1. Listing —— */

export type OpsListingAlertData = {
  event: OpsAlertEvent;
  leadId: string;
  quantity: number;
  askEach: number | null;
  paidEach: number | null;
  sellerName: string | null;
  contactPhone: string | null;
  contactInstagram: string | null;
  ticketShareUrl: string | null;
  hasEvidence: boolean;
  etransferName: string | null;
  etransferEmail: string | null;
  etransferPhone: string | null;
  /** Custody events: where the seller must transfer the ticket. */
  custody: { name: string; email: string } | null;
  opsUrl: string;
};

export function opsListingAlert(d: OpsListingAlertData): OpsAlertContent {
  const who = d.sellerName?.trim() || handle(d.contactInstagram) || "A seller";
  const ask = money(d.askEach);
  return build({
    subject: `NEW LISTING · ${d.event.name} · ${d.quantity}×${ask ? ` ${ask}` : ""}`,
    preheader: `${who} listed ${tickets(d.quantity)}${ask ? ` at ${ask} each` : ""}.`,
    event: d.event,
    tone: "info",
    title: "New ticket listed",
    summary: `${who} listed ${tickets(d.quantity)}${ask ? ` at ${ask} each` : ""}.`,
    note: d.custody
      ? `Custody event: the seller has to transfer the ticket to ${d.custody.name} (${d.custody.email}). Verify it on the Transactions queue once it lands.`
      : null,
    sections: [
      {
        title: "Listing",
        rows: [
          { label: "Tickets", value: String(d.quantity) },
          { label: "Asking", value: ask ? `${ask} each` : null },
          { label: "Paid", value: money(d.paidEach) ? `${money(d.paidEach)} each` : null },
          { label: "Ticket link", value: d.ticketShareUrl ? "Open link" : "—", href: d.ticketShareUrl },
          { label: "Screenshot", value: d.hasEvidence ? "Uploaded" : "None" },
        ],
      },
      {
        title: "Seller",
        rows: [
          { label: "Phone", value: d.contactPhone },
          { label: "Instagram", value: handle(d.contactInstagram) },
        ],
      },
      {
        title: "Interac payout",
        rows: [
          { label: "Name", value: d.etransferName },
          { label: "Email", value: d.etransferEmail },
          { label: "Phone", value: d.etransferPhone },
        ],
      },
    ],
    primary: { label: "Open in ops →", url: d.opsUrl },
    secondary: d.ticketShareUrl ? { label: "View ticket", url: d.ticketShareUrl } : null,
    reference: `Listing ${d.leadId}`,
  });
}

/* —— 2. Waitlist —— */

export type OpsWaitlistAlertData = {
  event: OpsAlertEvent;
  leadId: string;
  quantity: number;
  maxPriceEach: number | null;
  position: number | null;
  buyerName: string | null;
  transferEmail: string | null;
  contactPhone: string | null;
  contactInstagram: string | null;
  opsUrl: string;
};

export function opsWaitlistAlert(d: OpsWaitlistAlertData): OpsAlertContent {
  const who = d.buyerName?.trim() || handle(d.contactInstagram) || "Someone";
  const pos = d.position != null ? `#${d.position}` : null;
  return build({
    subject: `NEW WAITLIST MEMBER · ${d.event.name} · ${who}${pos ? ` · ${pos}` : ""}`,
    preheader: `${who} wants ${tickets(d.quantity)}${pos ? `, ${pos} in line` : ""}.`,
    event: d.event,
    tone: "info",
    title: "New on the waitlist",
    summary: `${who} wants ${tickets(d.quantity)}${pos ? ` and is ${pos} in line` : ""}.`,
    sections: [
      {
        title: "Request",
        rows: [
          { label: "Tickets", value: String(d.quantity) },
          { label: "Position", value: pos },
          { label: "Max price", value: money(d.maxPriceEach) ? `${money(d.maxPriceEach)} each` : "No limit" },
        ],
      },
      {
        title: "Buyer",
        rows: [
          { label: "Name", value: d.buyerName },
          { label: "Email", value: d.transferEmail, href: d.transferEmail ? `mailto:${d.transferEmail}` : null },
          { label: "Phone", value: d.contactPhone },
          { label: "Instagram", value: handle(d.contactInstagram) },
        ],
      },
    ],
    primary: { label: "Open in ops →", url: d.opsUrl },
    reference: `Waitlist lead ${d.leadId}`,
  });
}

/* —— 3. Match —— */

export type OpsMatchCustody = "verified" | "declared" | "not_sent" | null;

export type OpsMatchAlertData = {
  event: OpsAlertEvent;
  offerId: string;
  priceEach: number;
  rank: number | null;
  expiresAt: string;
  buyer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    instagram: string | null;
  };
  seller: {
    name: string | null;
    phone: string | null;
    instagram: string | null;
    etransferEmail: string | null;
  };
  /** Custody events only; null where the seller transfers straight to the buyer. */
  custody: OpsMatchCustody;
  opsUrl: string;
};

function matchNextStep(custody: OpsMatchCustody, expires: string): string {
  switch (custody) {
    case "verified":
      return `The ticket is verified in custody. Watch for the buyer's Interac before ${expires}, confirm it, then forward the ticket.`;
    case "declared":
      return `The seller says they transferred the ticket, but it isn't verified yet. Check the inbox and verify it before the buyer pays (hold ends ${expires}).`;
    case "not_sent":
      return `The seller hasn't transferred the ticket to us yet. Chase them now, before the buyer pays (hold ends ${expires}).`;
    default:
      return `Confirm the seller is ready to transfer, and watch for the buyer's Interac before the hold ends ${expires}.`;
  }
}

function custodyText(custody: OpsMatchCustody): string | null {
  return custody === "verified"
    ? "Verified in custody"
    : custody === "declared"
      ? "Seller says sent — not verified"
      : custody === "not_sent"
        ? "Not transferred yet"
        : null;
}

export function opsMatchAlert(d: OpsMatchAlertData): OpsAlertContent {
  const buyer = d.buyer.name?.trim() || handle(d.buyer.instagram) || "A buyer";
  const seller = d.seller.name?.trim() || handle(d.seller.instagram) || "a seller";
  const price = money(d.priceEach) ?? "—";
  const expires = formatMontreal(d.expiresAt);
  const custodyLabel = custodyText(d.custody);
  return build({
    subject: `MATCH - ACTION NEEDED · ${d.event.name} · ${price}`,
    preheader: `${buyer} matched with ${seller} at ${price}. Hold ends ${expires}.`,
    event: d.event,
    tone: "action",
    title: "Match — action needed",
    summary: `${buyer} was matched with ${seller}'s ticket at ${price}. Their hold is open until ${expires}.`,
    note: matchNextStep(d.custody, expires),
    sections: [
      {
        title: "Match",
        rows: [
          { label: "Price", value: price },
          { label: "Hold ends", value: expires },
          { label: "Queue rank", value: d.rank != null ? `#${d.rank}` : null },
          { label: "Seller ticket", value: custodyLabel },
        ],
      },
      {
        title: "Buyer",
        rows: [
          { label: "Name", value: d.buyer.name },
          { label: "Email", value: d.buyer.email, href: d.buyer.email ? `mailto:${d.buyer.email}` : null },
          { label: "Phone", value: d.buyer.phone },
          { label: "Instagram", value: handle(d.buyer.instagram) },
        ],
      },
      {
        title: "Seller",
        rows: [
          { label: "Name", value: d.seller.name },
          { label: "Phone", value: d.seller.phone },
          { label: "Instagram", value: handle(d.seller.instagram) },
          { label: "Interac email", value: d.seller.etransferEmail },
        ],
      },
    ],
    primary: { label: "Open in ops →", url: d.opsUrl },
    reference: `Offer ${d.offerId}`,
  });
}

/* —— 4. Fixed-price order —— */

export type OpsFixedPriceOrderAlertData = {
  event: OpsAlertEvent;
  leadId: string;
  quantity: number;
  /** Total the buyer says they sent, all in. */
  amount: number | null;
  /** The Interac memo buyers are told to use for this event. */
  memoHint: string;
  declaredAt: string | null;
  position: number | null;
  buyer: {
    name: string | null;
    /** Where the ticket gets transferred. */
    email: string | null;
    phone: string | null;
    instagram: string | null;
  };
  /** Deep link to this row on the ops Transactions board. */
  opsUrl: string;
};

/**
 * A fixed-price buyer joined the queue, which on these events means they've
 * also told us the Interac is sent. Someone has to find it and confirm it.
 */
export function opsFixedPriceOrderAlert(d: OpsFixedPriceOrderAlertData): OpsAlertContent {
  const who = d.buyer.name?.trim() || handle(d.buyer.instagram) || "A buyer";
  const amount = money(d.amount);
  const sendTo = d.buyer.email?.trim() || "the buyer's transfer email";
  return build({
    subject: `FIXED PRICE - CONFIRM PAYMENT · ${d.event.name} · ${tickets(d.quantity)}${amount ? ` · ${amount}` : ""}`,
    preheader: `${who} says they sent ${amount ?? "their Interac"} for ${tickets(d.quantity)}.`,
    event: d.event,
    tone: "action",
    title: "New fixed-price order",
    summary: `${who} joined the queue for ${tickets(d.quantity)} and says they sent ${amount ?? "the Interac"}.`,
    note: `Find the Interac${amount ? ` of ${amount}` : ""} (memo ${d.memoHint}), confirm it on the Transactions board, then send the ${d.quantity === 1 ? "ticket" : "tickets"} to ${sendTo}.`,
    sections: [
      {
        title: "Payment",
        rows: [
          { label: "Amount", value: amount ? `${amount} CAD` : null },
          { label: "Interac memo", value: d.memoHint },
          { label: "Sent", value: d.declaredAt ? formatMontreal(d.declaredAt) : null },
          { label: "Tickets", value: String(d.quantity) },
          { label: "Queue position", value: d.position != null ? `#${d.position}` : null },
        ],
      },
      {
        title: "Buyer",
        rows: [
          { label: "Name", value: d.buyer.name },
          { label: "Ticket email", value: d.buyer.email, href: d.buyer.email ? `mailto:${d.buyer.email}` : null },
          { label: "Phone", value: d.buyer.phone },
          { label: "Instagram", value: handle(d.buyer.instagram) },
        ],
      },
    ],
    primary: { label: "Open transaction →", url: d.opsUrl },
    reference: `Order ${d.leadId}`,
  });
}

/* —— 5. Resale payment declared —— */

export type OpsPaymentDeclaredAlertData = Omit<OpsMatchAlertData, "rank" | "expiresAt"> & {
  /** The memo this buyer was told to put on the Interac. */
  memoHint: string;
  declaredAt: string | null;
};

function paymentNextStep(custody: OpsMatchCustody, amount: string, memo: string): string {
  const find = `Find the Interac of ${amount} (memo ${memo}) and confirm it in ops.`;
  switch (custody) {
    case "verified":
      return `${find} The ticket is already verified in custody, so forward it to the buyer right after.`;
    case "declared":
      return `${find} The seller's ticket isn't verified yet — check the inbox before forwarding.`;
    case "not_sent":
      return `${find} The seller hasn't transferred the ticket to us yet — chase them now.`;
    default:
      return `${find} Then get the seller's ticket to the buyer.`;
  }
}

/** A buyer holding a resale ticket tapped "I've sent the money". */
export function opsPaymentDeclaredAlert(d: OpsPaymentDeclaredAlertData): OpsAlertContent {
  const buyer = d.buyer.name?.trim() || handle(d.buyer.instagram) || "A buyer";
  const amount = money(d.priceEach) ?? "—";
  return build({
    subject: `PAYMENT SENT - VERIFY · ${d.event.name} · ${amount}`,
    preheader: `${buyer} says they sent ${amount} (memo ${d.memoHint}).`,
    event: d.event,
    tone: "action",
    title: "Buyer says they paid",
    summary: `${buyer} says they sent ${amount} by Interac for their held ticket.`,
    note: paymentNextStep(d.custody, amount, d.memoHint),
    sections: [
      {
        title: "Payment",
        rows: [
          { label: "Amount", value: `${amount} CAD` },
          { label: "Interac memo", value: d.memoHint },
          { label: "Sent", value: d.declaredAt ? formatMontreal(d.declaredAt) : null },
          { label: "Seller ticket", value: custodyText(d.custody) },
        ],
      },
      {
        title: "Buyer",
        rows: [
          { label: "Name", value: d.buyer.name },
          { label: "Email", value: d.buyer.email, href: d.buyer.email ? `mailto:${d.buyer.email}` : null },
          { label: "Phone", value: d.buyer.phone },
          { label: "Instagram", value: handle(d.buyer.instagram) },
        ],
      },
      {
        title: "Seller",
        rows: [
          { label: "Name", value: d.seller.name },
          { label: "Phone", value: d.seller.phone },
          { label: "Instagram", value: handle(d.seller.instagram) },
          { label: "Interac email", value: d.seller.etransferEmail },
        ],
      },
    ],
    primary: { label: "Open in ops →", url: d.opsUrl },
    reference: `Offer ${d.offerId}`,
  });
}
