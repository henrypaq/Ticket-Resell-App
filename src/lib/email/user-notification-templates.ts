/**
 * Yellow-brand user lifecycle emails — shell + builders.
 * Parallel to ops-event-alerts (the ops inbox set).
 *
 * Layout: yellow page ground → white message card → black footer band.
 * No status pills/badges/chips. Escape every user/event string before HTML.
 */

export type UserEmailContent = {
  subject: string;
  text: string;
  html: string;
  preheader: string;
};

export type BrandedEmailCta = {
  label: string;
  url: string;
  /** primary = yellow bg / black text; inverse = black bg / yellow text */
  variant?: "primary" | "inverse";
};

export type BrandedEventCard = {
  name: string;
  /** e.g. "Tue–Sat · Montreal · on the waitlist" */
  meta?: string;
  flyerUrl?: string | null;
  cta?: BrandedEmailCta;
};

export type BrandedSellPivot = {
  headline: string;
  bodyHtml: string;
  cta: BrandedEmailCta;
};

const YELLOW = "#fbbf24";
const INK = "#0B0B0C";
const BODY = "#46464A";
const MUTED_ON_BLACK = "#9A9A9E";
const MUTED_ON_DARK = "#C7C7CA";
const SERIF = "Charter, Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const DISPLAY = "'Arial Black', Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ctaButton(cta: BrandedEmailCta): string {
  const primary = cta.variant !== "inverse";
  const bg = primary ? YELLOW : INK;
  const color = primary ? INK : YELLOW;
  return `<a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:${bg};color:${color};font-family:${SANS};font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.01em;">${escapeHtml(cta.label)}</a>`;
}

function logoMark(sizePx: number): string {
  const fontSize = Math.round(sizePx * 0.38);
  return `<div style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:${INK};margin:0 auto;line-height:${sizePx}px;text-align:center;">
    <span style="display:inline-block;color:${YELLOW};font-family:${DISPLAY};font-size:${fontSize}px;font-weight:900;letter-spacing:-1px;vertical-align:middle;">m.t</span>
  </div>`;
}

function eventCardHtml(card: BrandedEventCard): string {
  const flyer =
    card.flyerUrl && card.flyerUrl.trim()
      ? `<img src="${escapeHtml(card.flyerUrl)}" alt="" width="520" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:12px 12px 0 0;" />`
      : "";
  const meta = card.meta
    ? `<p style="margin:8px 0 0;color:${MUTED_ON_DARK};font-family:${SANS};font-size:13px;line-height:1.4;">${escapeHtml(card.meta)}</p>`
    : "";
  const cta = card.cta
    ? `<p style="margin:18px 0 0;">${ctaButton(card.cta)}</p>`
    : "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;border-collapse:collapse;background:${INK};border-radius:12px;overflow:hidden;">
      ${flyer ? `<tr><td style="padding:0;line-height:0;">${flyer}</td></tr>` : ""}
      <tr>
        <td style="padding:22px 24px 24px;">
          <p style="margin:0;color:#FFFFFF;font-family:${SERIF};font-size:22px;line-height:1.25;font-weight:600;">${escapeHtml(card.name)}</p>
          ${meta}
          ${cta}
        </td>
      </tr>
    </table>`;
}

function sellPivotHtml(pivot: BrandedSellPivot): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;border-collapse:collapse;background:${INK};border-radius:12px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 12px;color:${YELLOW};font-family:${SERIF};font-size:22px;line-height:1.25;font-weight:600;">${escapeHtml(pivot.headline)}</p>
          <div style="color:${MUTED_ON_DARK};font-family:${SANS};font-size:15px;line-height:1.55;">${pivot.bodyHtml}</div>
          <p style="margin:20px 0 0;">${ctaButton({ ...pivot.cta, variant: pivot.cta.variant ?? "primary" })}</p>
        </td>
      </tr>
    </table>`;
}

/**
 * Full HTML document: yellow ground, white card, black footer.
 * Callers pass pre-escaped HTML fragments in `bodyHtml` / pivot body.
 */
export function brandedEmailShell(args: {
  preheader: string;
  headline: string;
  bodyHtml: string;
  cta?: BrandedEmailCta;
  eventCard?: BrandedEventCard;
  sellPivot?: BrandedSellPivot;
  footerNote?: string;
}): string {
  const preheader = escapeHtml(args.preheader);
  const headline = escapeHtml(args.headline);
  const footerNote = args.footerNote
    ? `<p style="margin:28px 0 0;color:${BODY};font-family:${SANS};font-size:13px;line-height:1.5;">${escapeHtml(args.footerNote)}</p>`
    : "";
  const ctaBlock = args.cta
    ? `<p style="margin:28px 0 0;">${ctaButton(args.cta)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:${YELLOW};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${YELLOW};opacity:0;">
    ${preheader}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${YELLOW};">
    <tr>
      <td align="center" style="padding:36px 16px 28px;">
        ${logoMark(72)}
        <p style="margin:14px 0 0;color:${INK};font-family:${DISPLAY};font-size:13px;font-weight:900;letter-spacing:0.04em;">mcgill.tickets</p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 16px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:collapse;background:#FFFFFF;border-radius:16px;">
          <tr>
            <td style="padding:36px 28px 40px;">
              <h1 style="margin:0 0 28px;color:${INK};font-family:${SERIF};font-size:32px;line-height:1.2;font-weight:600;">${headline}</h1>
              ${args.eventCard ? eventCardHtml(args.eventCard) : ""}
              <div style="color:${BODY};font-family:${SANS};font-size:16px;line-height:1.6;">${args.bodyHtml}</div>
              ${ctaBlock}
              ${args.sellPivot ? sellPivotHtml(args.sellPivot) : ""}
              ${footerNote}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0;background:${INK};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:collapse;">
          <tr>
            <td style="padding:28px 24px 32px;text-align:center;">
              ${logoMark(40)}
              <p style="margin:12px 0 0;color:#FFFFFF;font-family:${DISPLAY};font-size:12px;font-weight:900;letter-spacing:0.04em;">mcgill.tickets</p>
              <p style="margin:14px 0 0;color:${MUTED_ON_BLACK};font-family:${SANS};font-size:12px;line-height:1.5;">Montréal, QC</p>
              <p style="margin:6px 0 0;color:${MUTED_ON_BLACK};font-family:${SANS};font-size:11px;line-height:1.5;">Questions? Reply to this email — a real person reads these.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function p(html: string): string {
  return `<p style="margin:0 0 16px;">${html}</p>`;
}

function strong(text: string): string {
  return `<strong style="color:${INK};">${escapeHtml(text)}</strong>`;
}

export type LifecycleEmailArgs = {
  eventName: string;
  price: number;
  offerId?: string;
  deadline?: string;
  eventSlug?: string | null;
  transferName?: string;
  transferEmail?: string;
  quantity?: number;
  appUrl: string;
  offerUrl?: string;
  payoutConfirmUrl?: string;
  /** Fixed-price: the buyer's in-app ticket screen (`/queue?lead=…`). */
  ticketUrl?: string;
  /** Fixed-price: who the ticket is issued to. */
  recipientName?: string | null;
  recipientEmail?: string | null;
  flyerUrl?: string | null;
  eventDay?: string | null;
  eventCity?: string | null;
};

function priceLabel(price: number): string {
  return `$${price.toFixed(2)}`;
}

function eventMeta(args: {
  eventDay?: string | null;
  eventCity?: string | null;
  suffix?: string;
}): string | undefined {
  const parts = [args.eventDay, args.eventCity, args.suffix].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
  return parts.length ? parts.join(" · ") : undefined;
}

function eventCardFromArgs(
  args: LifecycleEmailArgs,
  suffix?: string,
  cta?: BrandedEmailCta,
): BrandedEventCard | undefined {
  if (!args.eventName) return undefined;
  return {
    name: args.eventName,
    flyerUrl: args.flyerUrl,
    meta: eventMeta({
      eventDay: args.eventDay,
      eventCity: args.eventCity,
      suffix,
    }),
    cta,
  };
}

function wrap(
  subject: string,
  text: string,
  preheader: string,
  headline: string,
  bodyHtml: string,
  extras?: {
    cta?: BrandedEmailCta;
    eventCard?: BrandedEventCard;
    sellPivot?: BrandedSellPivot;
    footerNote?: string;
  },
): UserEmailContent {
  return {
    subject,
    text,
    preheader,
    html: brandedEmailShell({
      preheader,
      headline,
      bodyHtml,
      cta: extras?.cta,
      eventCard: extras?.eventCard,
      sellPivot: extras?.sellPivot,
      footerNote: extras?.footerNote,
    }),
  };
}

/* —— Signup welcome —— */

export function signupWelcomeEmail(args: {
  name?: string;
  eventName?: string;
  eventDay?: string;
  eventCity?: string;
  flyerUrl?: string;
  appUrl: string;
  sellUrl: string;
}): UserEmailContent {
  const hasEvent = Boolean(args.eventName);
  const subject = "You're in — welcome to mcgill.tickets";
  const preheader = "We'll email you the second something matches what you're after.";
  const greeting = args.name?.trim() ? `Hi ${args.name.trim()}, you're in.` : "You're in.";

  const waitlistLine = hasEvent
    ? `You're on the waitlist for ${args.eventName}. When it's your turn to buy a ticket, you'll get an email with the price and a link straight to it.`
    : `When it's your turn to buy a ticket, you'll get an email with the price and a link straight to it.`;

  const text = [
    greeting.replace(/\.$/, ""),
    "",
    waitlistLine,
    "",
    "Send the amount by e-transfer to reserve your ticket, and you'll receive it automatically from the seller. If it doesn't arrive within 15 minutes, your money is refunded in full — and if the price isn't right for you, you're welcome to pass and wait for the next one.",
    "",
    "Got a ticket to sell instead?",
    `List it at face value in under a minute: ${args.sellUrl}`,
    "",
    `Open the app: ${args.appUrl}`,
    "",
    "— mcgill.tickets",
  ].join("\n");

  const bodyHtml = [
    p(
      hasEvent
        ? `You're on the waitlist for ${strong(args.eventName!)}. When it's your turn to buy a ticket, you'll get an email with the price and a link straight to it.`
        : `When it's your turn to buy a ticket, you'll get an email with the price and a link straight to it.`,
    ),
    p(
      `Send the amount by e-transfer to reserve your ticket, and you'll receive it automatically from the seller. If it doesn't arrive within 15 minutes, your money is refunded in full — and if the price isn't right for you, you're welcome to pass and wait for the next one.`,
    ),
  ].join("");

  return wrap(subject, text, preheader, "You're in.", bodyHtml, {
    eventCard: hasEvent
      ? {
          name: args.eventName!,
          flyerUrl: args.flyerUrl,
          meta: eventMeta({
            eventDay: args.eventDay,
            eventCity: args.eventCity,
            suffix: "on the waitlist",
          }),
          cta: { label: "View your waitlist →", url: args.appUrl, variant: "primary" },
        }
      : undefined,
    cta: hasEvent
      ? undefined
      : { label: "Open mcgill.tickets →", url: args.appUrl, variant: "inverse" },
    sellPivot: {
      headline: "Got a ticket to sell instead?",
      bodyHtml: `<p style="margin:0;">List it at face value in under a minute. Once someone reserves it, their e-transfer comes straight to you — send the ticket over and you're done.</p>`,
      cta: { label: "List your ticket →", url: args.sellUrl, variant: "primary" },
    },
    footerNote: "Questions? Just reply to this email — a real person reads these.",
  });
}

/* —— Event request received —— */

export function eventRequestReceivedEmail(args: {
  eventNameRequested: string;
  details?: string | null;
  appUrl: string;
  supportedEventsShortlist?: string;
}): UserEmailContent {
  const subject = "We got your event request";
  const preheader = "We'll take a look and add it if we can.";
  const shortlist = args.supportedEventsShortlist?.trim() || "Café Campus";
  const detailsLine = args.details?.trim()
    ? `\n\nDetails you shared: ${args.details.trim()}`
    : "";

  const text = [
    "Got it.",
    "",
    `Thanks for flagging ${args.eventNameRequested} — we hadn't added it yet. An admin reviews every requested event before it's postable.`,
    detailsLine.trim(),
    "",
    `If we can verify it, it'll show up in the app. ${shortlist} ${shortlist.includes(" are ") ? "" : "is"} already live — browse while you wait: ${args.appUrl}`,
    "",
    "— mcgill.tickets",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const bodyHtml = [
    p(
      `Thanks for flagging ${strong(args.eventNameRequested)} — we hadn't added it yet. An admin reviews every requested event before it's postable, which is what keeps the face-value price cap trustworthy on every listing across the app.`,
    ),
    args.details?.trim()
      ? p(`Details you shared: ${escapeHtml(args.details.trim())}`)
      : "",
    p(
      `If we can verify it, it'll show up in the app and you'll be able to join its waitlist or list a ticket against it. We don't have a way to notify you the moment that happens yet, so check back next time you're browsing.`,
    ),
  ].join("");

  return wrap(subject, text, preheader, "Got it.", bodyHtml, {
    eventCard: {
      name: args.eventNameRequested,
      meta: "Submitted · under review",
    },
    sellPivot: {
      headline: "In the meantime",
      bodyHtml: `<p style="margin:0;">${escapeHtml(shortlist)} ${shortlist.toLowerCase().includes(" are ") ? "are" : "is"} already live — join a waitlist while you wait on this one.</p>`,
      cta: { label: "Browse events →", url: args.appUrl, variant: "primary" },
    },
    footerNote: "Questions? Just reply to this email — a real person reads these.",
  });
}

/* —— Lifecycle builders (mirror notify.ts subjects/text) —— */

export function offeredEmail(args: LifecycleEmailArgs): UserEmailContent {
  const link = args.offerUrl ?? args.appUrl;
  const price = priceLabel(args.price);
  const subject = `Ticket ready — ${args.eventName}`;
  const preheader = `A ticket is held for you at ${price}.`;
  const text = `A ticket for ${args.eventName} is being held for you at ${price}.${args.deadline ? ` Respond by ${args.deadline}.` : ""}\n\nClaim it, then you'll get Interac details on the next screen: ${link}\n\n— mcgill.tickets`;
  const bodyHtml = [
    p(
      `A ticket for ${strong(args.eventName)} is being held for you at ${strong(price)}.`,
    ),
    args.deadline
      ? p(`Respond by ${strong(args.deadline)}.`)
      : "",
  ].join("");
  return wrap(subject, text, preheader, "Ticket ready.", bodyHtml, {
    eventCard: eventCardFromArgs(args, `${price} hold`),
    cta: { label: "Claim your ticket →", url: link, variant: "primary" },
  });
}

export function reminderEmail(args: LifecycleEmailArgs): UserEmailContent {
  const link = args.offerUrl ?? args.appUrl;
  const price = priceLabel(args.price);
  const subject = `Reminder: ${args.eventName} ticket hold`;
  const preheader = `Your hold at ${price} is still open.`;
  const text = `Your hold for ${args.eventName} at ${price} is still open.\n\n${link}\n\n— mcgill.tickets`;
  const bodyHtml = p(
    `Your hold for ${strong(args.eventName)} at ${strong(price)} is still open.`,
  );
  return wrap(subject, text, preheader, "Still holding your ticket.", bodyHtml, {
    eventCard: eventCardFromArgs(args),
    cta: { label: "Open your offer →", url: link, variant: "primary" },
  });
}

export function expiredEmail(args: LifecycleEmailArgs): UserEmailContent {
  const subject = `Hold expired — ${args.eventName}`;
  const preheader = "You're still on the waitlist.";
  const text = `Your hold for ${args.eventName} expired. You're still on the waitlist — we'll email you if another ticket fits.\n\n— mcgill.tickets`;
  const bodyHtml = p(
    `Your hold for ${strong(args.eventName)} expired. You're still on the waitlist — we'll email you if another ticket fits.`,
  );
  return wrap(subject, text, preheader, "Hold expired.", bodyHtml, {
    eventCard: eventCardFromArgs(args),
    cta: { label: "Open mcgill.tickets →", url: args.appUrl, variant: "inverse" },
  });
}

export function paidEmail(args: LifecycleEmailArgs): UserEmailContent {
  const link = args.offerUrl ?? args.appUrl;
  const subject = `Payment confirmed — ${args.eventName}`;
  const preheader = "We'll transfer the ticket shortly.";
  const text = `We confirmed your payment for ${args.eventName}. We'll transfer the ticket shortly.\n\nReceipt: ${link}\n\n— mcgill.tickets`;
  const bodyHtml = p(
    `We confirmed your payment for ${strong(args.eventName)}. We'll transfer the ticket shortly.`,
  );
  return wrap(subject, text, preheader, "Payment confirmed.", bodyHtml, {
    eventCard: eventCardFromArgs(args),
    cta: { label: "View receipt →", url: link, variant: "primary" },
  });
}

export function paymentDeclaredEmail(args: LifecycleEmailArgs): UserEmailContent {
  const link = args.offerUrl ?? args.appUrl;
  const price = priceLabel(args.price);
  const subject = `Got it — matching your payment · ${args.eventName}`;
  const preheader = "We're matching your Interac to the hold.";
  const text = `Thanks — we see you said you sent Interac for ${args.eventName} (${price}). We're matching it to your hold now. You'll get another email when we confirm it.\n\n${link}\n\n— mcgill.tickets`;
  const bodyHtml = [
    p(
      `Thanks — we see you said you sent Interac for ${strong(args.eventName)} (${escapeHtml(price)}).`,
    ),
    p(`We're matching it to your hold now. You'll get another email when we confirm it.`),
  ].join("");
  return wrap(subject, text, preheader, "Got it — matching your payment.", bodyHtml, {
    eventCard: eventCardFromArgs(args),
    cta: { label: "View your offer →", url: link, variant: "primary" },
  });
}

export function ticketForwardedEmail(args: LifecycleEmailArgs): UserEmailContent {
  const link = args.offerUrl ?? args.appUrl;
  const subject = `Your ${args.eventName} ticket is on the way`;
  const preheader = "Check your inbox (and spam) for the transfer.";
  const text = `We've sent your ${args.eventName} ticket to the email/name on your order. Check your inbox (and spam) for the transfer.\n\n${link}\n\n— mcgill.tickets`;
  const bodyHtml = [
    p(
      `We've sent your ${strong(args.eventName)} ticket to the email/name on your order.`,
    ),
    p(`Check your inbox (and spam) for the transfer.`),
  ].join("");
  return wrap(subject, text, preheader, "Your ticket is on the way.", bodyHtml, {
    eventCard: eventCardFromArgs(args),
    cta: { label: "View receipt →", url: link, variant: "primary" },
  });
}

export function waitlistJoinedEmail(args: LifecycleEmailArgs): UserEmailContent {
  const subject = `You're on the waitlist — ${args.eventName}`;
  const preheader = "We'll email you when a ticket is held for you.";
  const text = `You're on the waitlist for ${args.eventName}. When a ticket is held exclusively for you, we'll email you with a short claim window.\n\n${args.appUrl}\n\n— mcgill.tickets`;
  const bodyHtml = [
    p(`You're on the waitlist for ${strong(args.eventName)}.`),
    p(
      `When a ticket is held exclusively for you, we'll email you with a short claim window.`,
    ),
  ].join("");
  return wrap(subject, text, preheader, "You're on the waitlist.", bodyHtml, {
    eventCard: eventCardFromArgs(args, "on the waitlist", {
      label: "View your waitlist →",
      url: args.appUrl,
      variant: "primary",
    }),
  });
}

export function nextUpEmail(args: LifecycleEmailArgs): UserEmailContent {
  const subject = `You're next — ${args.eventName}`;
  const preheader = "No action needed yet.";
  const text = `You're next in line for ${args.eventName} if the current hold falls through. No action needed yet.\n\n— mcgill.tickets`;
  const bodyHtml = p(
    `You're next in line for ${strong(args.eventName)} if the current hold falls through. No action needed yet.`,
  );
  return wrap(subject, text, preheader, "You're next.", bodyHtml, {
    eventCard: eventCardFromArgs(args, "next in line"),
  });
}

/* —— Fixed-price events: the buyer paid up front; ops confirms, then sends —— */

function ticketsLabel(quantity: number | undefined): string {
  return quantity && quantity > 1 ? `${quantity} tickets` : "ticket";
}

/** Ops confirmed the fixed-price buyer's Interac landed. */
export function fixedPricePaidEmail(args: LifecycleEmailArgs): UserEmailContent {
  const link = args.ticketUrl ?? args.appUrl;
  const tickets = ticketsLabel(args.quantity);
  const amount = args.price > 0 ? priceLabel(args.price) : null;
  const subject = `Payment confirmed — ${args.eventName}`;
  const preheader = "Your spot is locked in. We'll email your ticket.";
  const paidLine = amount
    ? `We received your Interac of ${amount} for your ${args.eventName} ${tickets}.`
    : `We received your Interac for your ${args.eventName} ${tickets}.`;
  const text = `${paidLine} Your spot in line is locked in.

Nothing else to do — we'll email you as soon as your ticket is sent.

${link}

— mcgill.tickets`;
  const bodyHtml = [
    p(
      amount
        ? `We received your Interac of ${strong(amount)} for your ${strong(args.eventName)} ${escapeHtml(tickets)}. Your spot in line is locked in.`
        : `We received your Interac for your ${strong(args.eventName)} ${escapeHtml(tickets)}. Your spot in line is locked in.`,
    ),
    p(`Nothing else to do — we'll email you as soon as your ticket is sent.`),
  ].join("");
  return wrap(subject, text, preheader, "Payment confirmed.", bodyHtml, {
    eventCard: eventCardFromArgs(args, "paid"),
    cta: { label: "View your spot →", url: link, variant: "primary" },
  });
}

/** Ops sent the fixed-price ticket to the buyer's transfer email. */
export function fixedPriceTicketSentEmail(args: LifecycleEmailArgs): UserEmailContent {
  const link = args.ticketUrl ?? args.appUrl;
  const tickets = ticketsLabel(args.quantity);
  const to = args.recipientEmail?.trim() || null;
  const name = args.recipientName?.trim() || null;
  const subject = `Your ${args.eventName} ${tickets === "ticket" ? "ticket is" : "tickets are"} here`;
  const preheader = to ? `Sent to ${to}.` : "Check your inbox for the transfer.";
  const whereText = to
    ? `We sent your ${args.eventName} ${tickets} to ${to}${name ? ` under ${name}` : ""}.`
    : `We sent your ${args.eventName} ${tickets} to the email on your order.`;
  const whereHtml = to
    ? `We sent your ${strong(args.eventName)} ${escapeHtml(tickets)} to ${strong(to)}${name ? ` under ${strong(name)}` : ""}.`
    : `We sent your ${strong(args.eventName)} ${escapeHtml(tickets)} to the email on your order.`;
  const text = `${whereText} Look in spam if you don't see it within a few minutes.

Open your ticket: ${link}

— mcgill.tickets`;
  const bodyHtml = [
    p(whereHtml),
    p(`Look in spam if you don't see it within a few minutes.`),
  ].join("");
  return wrap(subject, text, preheader, "Your ticket is here.", bodyHtml, {
    eventCard: eventCardFromArgs(args, "ticket sent"),
    cta: { label: "Open your ticket →", url: link, variant: "primary" },
    footerNote: "Something wrong with the ticket? Just reply to this email.",
  });
}

export function sellerListedEmail(args: LifecycleEmailArgs): UserEmailContent {
  const qtyLabel =
    args.quantity && args.quantity > 1 ? `${args.quantity} tickets are` : "ticket is";
  const subject = `Listing received — ${args.eventName}`;
  const preheader = "We'll email you when your payout is sent.";
  const text = `Thanks for listing on mcgill.tickets.\n\nYour ${qtyLabel} listed for ${args.eventName}. We match one buyer at a time: they pay us by Interac, then we pay you when the sale clears.\n\nWe'll email you when your payout is sent.\n\n${args.appUrl}\n\n— mcgill.tickets`;
  const bodyHtml = [
    p(`Thanks for listing on ${strong("mcgill.tickets")}.`),
    p(
      `Your ${escapeHtml(qtyLabel)} listed for ${strong(args.eventName)}. We match one buyer at a time: they pay us by Interac, then we pay you when the sale clears.`,
    ),
    p(`We'll email you when your payout is sent.`),
  ].join("");
  return wrap(subject, text, preheader, "Listing received.", bodyHtml, {
    eventCard: eventCardFromArgs(args, "listed to sell"),
    cta: { label: "Open mcgill.tickets →", url: args.appUrl, variant: "inverse" },
  });
}

/**
 * Custody events (Café Campus): sent on posting. Confirms the posting and asks
 * the seller to transfer the ticket to our account — ops can't verify (or
 * sell) a ticket that never arrived.
 */
export function sellerListedCustodyEmail(args: LifecycleEmailArgs): UserEmailContent {
  const tickets =
    args.quantity && args.quantity > 1 ? `${args.quantity} tickets` : "ticket";
  const toName = args.transferName?.trim() || "McGill Tickets";
  const toEmail = args.transferEmail?.trim() || null;
  const destText = toEmail ? `${toName} (${toEmail})` : toName;
  const destHtml = toEmail
    ? `${strong(toName)} (${strong(toEmail)})`
    : strong(toName);
  const subject = `Posting received — ${args.eventName}`;
  const preheader = "Transfer your ticket to us so we can verify it.";
  const text = [
    `We've received your posting for your ${args.eventName} ${tickets}.`,
    "",
    `If you haven't yet, transfer the ${tickets} to ${destText} now. Our admin team verifies every ticket before it's offered to a buyer, and we can't verify one that hasn't arrived.`,
    "",
    "Once it sells, we transfer it to the buyer and send your Interac payout. If it doesn't sell, or there's a problem, we transfer it back to you.",
    "",
    args.appUrl,
    "",
    "— mcgill.tickets",
  ].join("\n");
  const bodyHtml = [
    p(`We've received your posting for your ${strong(args.eventName)} ${escapeHtml(tickets)}.`),
    p(
      `If you haven't yet, transfer the ${escapeHtml(tickets)} to ${destHtml} now. Our admin team verifies every ticket before it's offered to a buyer, and we can't verify one that hasn't arrived.`,
    ),
    p(
      `Once it sells, we transfer it to the buyer and send your Interac payout. If it doesn't sell, or there's a problem, we transfer it back to you.`,
    ),
  ].join("");
  return wrap(subject, text, preheader, "Posting received.", bodyHtml, {
    eventCard: eventCardFromArgs(args, "awaiting verification"),
    cta: { label: "Open mcgill.tickets →", url: args.appUrl, variant: "inverse" },
    footerNote: "Already transferred? You're all set — we'll email you once it's verified.",
  });
}

export function sellerTicketReceivedEmail(args: LifecycleEmailArgs): UserEmailContent {
  const subject = `We have your ${args.eventName} ticket`;
  const preheader = "We'll forward it when a buyer pays.";
  const text = `We've confirmed your ${args.eventName} ticket is in our custody. When a buyer pays, we'll forward it and release your payout.\n\n${args.appUrl}\n\n— mcgill.tickets`;
  const bodyHtml = [
    p(
      `We've confirmed your ${strong(args.eventName)} ticket is in our custody.`,
    ),
    p(`When a buyer pays, we'll forward it and release your payout.`),
  ].join("");
  return wrap(subject, text, preheader, "Ticket in custody.", bodyHtml, {
    eventCard: eventCardFromArgs(args, "in custody"),
    cta: { label: "Open mcgill.tickets →", url: args.appUrl, variant: "inverse" },
  });
}

export function sellerPayoutReleasedEmail(args: LifecycleEmailArgs): UserEmailContent {
  const confirm = args.payoutConfirmUrl ?? args.appUrl;
  const price = priceLabel(args.price);
  const subject = `We sent your payout — ${args.eventName}`;
  const preheader = "Confirm when the Interac lands.";
  const text = `We've sent your Interac payout of ${price} for ${args.eventName} to the details on your listing.\n\nWhen it lands, confirm here so we can close the sale:\n${confirm}\n\n— mcgill.tickets`;
  const bodyHtml = [
    p(
      `We've sent your Interac payout of ${strong(price)} for ${strong(args.eventName)} to the details on your listing.`,
    ),
    p(`When it lands, confirm so we can close the sale.`),
  ].join("");
  return wrap(subject, text, preheader, "We sent your payout.", bodyHtml, {
    eventCard: eventCardFromArgs(args),
    cta: { label: "I received the money", url: confirm, variant: "primary" },
  });
}

export type LifecycleNotifyKind =
  | "offered"
  | "reminder"
  | "expired"
  | "paid"
  | "payment_declared"
  | "ticket_forwarded"
  | "waitlist_joined"
  | "next_up"
  | "fixed_price_paid"
  | "fixed_price_ticket_sent"
  | "seller_listed"
  | "seller_listed_custody"
  | "seller_ticket_received"
  | "seller_payout_released";

/** Dispatch helper used by notify.ts */
export function lifecycleEmail(
  kind: LifecycleNotifyKind,
  args: LifecycleEmailArgs,
): UserEmailContent {
  switch (kind) {
    case "offered":
      return offeredEmail(args);
    case "reminder":
      return reminderEmail(args);
    case "expired":
      return expiredEmail(args);
    case "paid":
      return paidEmail(args);
    case "payment_declared":
      return paymentDeclaredEmail(args);
    case "ticket_forwarded":
      return ticketForwardedEmail(args);
    case "waitlist_joined":
      return waitlistJoinedEmail(args);
    case "next_up":
      return nextUpEmail(args);
    case "fixed_price_paid":
      return fixedPricePaidEmail(args);
    case "fixed_price_ticket_sent":
      return fixedPriceTicketSentEmail(args);
    case "seller_listed":
      return sellerListedEmail(args);
    case "seller_listed_custody":
      return sellerListedCustodyEmail(args);
    case "seller_ticket_received":
      return sellerTicketReceivedEmail(args);
    case "seller_payout_released":
      return sellerPayoutReleasedEmail(args);
  }
}
