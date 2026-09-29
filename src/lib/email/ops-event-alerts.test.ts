import { describe, expect, it } from "vitest";
import {
  opsFixedPriceOrderAlert,
  opsPaymentDeclaredAlert,
  opsListingAlert,
  opsMatchAlert,
  opsWaitlistAlert,
  type OpsFixedPriceOrderAlertData,
  type OpsListingAlertData,
  type OpsMatchAlertData,
  type OpsWaitlistAlertData,
} from "@/lib/email/ops-event-alerts";

const event = {
  name: "Café Campus",
  meta: "Thu · Café Campus",
  flyerUrl: "https://mcgilltickets.party/flyers/cafe-campus.jpg",
};

const listing: OpsListingAlertData = {
  event,
  leadId: "11111111-1111-4111-8111-111111111111",
  quantity: 2,
  askEach: 25,
  paidEach: 25,
  sellerName: "Alex Martin",
  contactPhone: "+15145550100",
  contactInstagram: "alexm",
  ticketShareUrl: null,
  hasEvidence: true,
  etransferName: "Alex Martin",
  etransferEmail: "alex@example.test",
  etransferPhone: null,
  custody: { name: "McGill Tickets", email: "contact@mcgilltickets.party" },
  opsUrl: "https://mcgilltickets.party/ops/sellers",
};

const waitlist: OpsWaitlistAlertData = {
  event,
  leadId: "22222222-2222-4222-8222-222222222222",
  quantity: 1,
  maxPriceEach: null,
  position: 4,
  buyerName: "Sam Tremblay",
  transferEmail: "sam@example.test",
  contactPhone: null,
  contactInstagram: "samt",
  opsUrl: "https://mcgilltickets.party/ops/buyers",
};

const match: OpsMatchAlertData = {
  event,
  offerId: "33333333-3333-4333-8333-333333333333",
  priceEach: 25,
  rank: 1,
  expiresAt: "2026-10-02T01:30:00.000Z",
  buyer: { name: "Sam Tremblay", email: "sam@example.test", phone: null, instagram: "samt" },
  seller: { name: "Alex Martin", phone: "+15145550100", instagram: null, etransferEmail: "alex@example.test" },
  custody: "not_sent",
  opsUrl: "https://mcgilltickets.party/ops/sellers",
};

const order: OpsFixedPriceOrderAlertData = {
  event: { name: "Y2K Party @ APT200", meta: "Wed, Sep 24 · APT200", flyerUrl: event.flyerUrl },
  leadId: "44444444-4444-4444-8444-444444444444",
  quantity: 2,
  amount: 34.6,
  memoHint: "MT-Y2K",
  declaredAt: "2026-09-24T21:49:35.000Z",
  position: 3,
  buyer: { name: "Sam Tremblay", email: "sam@example.test", phone: null, instagram: "samt" },
  opsUrl: "https://mcgilltickets.party/ops#txn-44444444-4444-4444-8444-444444444444",
};

describe("ops event alerts share one dark, event-first shell", () => {
  const all = [
    opsListingAlert(listing),
    opsWaitlistAlert(waitlist),
    opsMatchAlert(match),
    opsFixedPriceOrderAlert(order),
  ];

  it("uses one sans face throughout — no serif headline", () => {
    for (const { html } of all) {
      expect(html).toContain("Geist");
      expect(html).not.toMatch(/Fraunces|Georgia|[^-]serif/);
    }
  });

  it("paints the flyer into the header behind a fade to black", () => {
    for (const { html } of all) {
      expect(html).toContain("url('https://mcgilltickets.party/flyers/cafe-campus.jpg')");
      expect(html).toContain("linear-gradient(180deg");
      expect(html).toContain("#0B0B0C");
    }
  });

  it("names the event in the header and in the plain-text version", () => {
    for (const { html, text } of all.slice(0, 3)) {
      expect(html).toContain("Café Campus");
      expect(text).toContain("Café Campus");
    }
  });

  it("falls back to a flat header without a usable flyer", () => {
    for (const flyerUrl of [undefined, "javascript:alert(1)", "/relative.jpg"]) {
      const { html } = opsWaitlistAlert({ ...waitlist, event: { name: "Piknik", flyerUrl } });
      expect(html).not.toContain("url('");
    }
  });

  it("escapes user-supplied values", () => {
    const { html } = opsWaitlistAlert({ ...waitlist, buyerName: "<img src=x onerror=1>" });
    expect(html).not.toContain("<img src=x");
  });

  it("can't break out of the CSS url() with a hostile flyer URL", () => {
    const { html } = opsListingAlert({
      ...listing,
      event: { ...event, flyerUrl: "https://x.test/a'),url(https://evil.test/b" },
    });
    const style = html.match(/background-image:[^"]*/)?.[0] ?? "";
    expect(style).toContain("url('https://x.test/a%27%29,url%28https://evil.test/b')");
    expect(style).not.toContain("url(https://evil.test");
  });
});

describe("each alert says what it is in the title", () => {
  it("listing", () => {
    const c = opsListingAlert(listing);
    expect(c.html).toContain("New ticket listed");
    expect(c.subject).toBe("NEW LISTING · Café Campus · 2× $25.00");
    expect(c.text).toContain("contact@mcgilltickets.party");
  });

  it("waitlist", () => {
    const c = opsWaitlistAlert(waitlist);
    expect(c.html).toContain("New on the waitlist");
    expect(c.subject).toBe("NEW WAITLIST MEMBER · Café Campus · Sam Tremblay · #4");
    expect(c.text).toContain("Max price: No limit");
  });

  it("match leads with the action and the custody gap", () => {
    const c = opsMatchAlert(match);
    expect(c.subject).toBe("MATCH - ACTION NEEDED · Café Campus · $25.00");
    expect(c.html).toContain("Match — action needed");
    expect(c.text).toContain("hasn't transferred the ticket to us yet");
    expect(c.text).toContain("Seller ticket: Not transferred yet");
  });

  it("match on a non-custody event skips the custody row", () => {
    const c = opsMatchAlert({ ...match, custody: null });
    expect(c.text).not.toContain("Seller ticket:");
  });

  it("fixed-price order says what to find and where the ticket goes", () => {
    const c = opsFixedPriceOrderAlert(order);
    expect(c.subject).toBe("FIXED PRICE - CONFIRM PAYMENT · Y2K Party @ APT200 · 2 tickets · $34.60");
    expect(c.html).toContain("New fixed-price order");
    expect(c.text).toContain("memo MT-Y2K");
    expect(c.text).toContain("send the tickets to sam@example.test");
    expect(c.html).toContain("ops#txn-44444444-4444-4444-8444-444444444444");
  });

  it("resale payment declared names the memo and the custody gap", () => {
    const c = opsPaymentDeclaredAlert({
      event,
      offerId: match.offerId,
      priceEach: 25,
      memoHint: "MT-3F9A2C",
      declaredAt: "2026-10-02T01:10:00.000Z",
      buyer: match.buyer,
      seller: match.seller,
      custody: "declared",
      opsUrl: "https://mcgilltickets.party/ops",
    });
    expect(c.subject).toBe("PAYMENT SENT - VERIFY · Café Campus · $25.00");
    expect(c.text).toContain("memo MT-3F9A2C");
    expect(c.text).toContain("isn't verified yet");
    expect(c.html).toContain("Geist");
  });
});
