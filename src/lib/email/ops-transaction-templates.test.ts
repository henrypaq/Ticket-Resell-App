import { describe, expect, it } from "vitest";
import {
  opsFixedPriceDeclaredHtml,
  opsFixedPriceDeclaredSubject,
  opsFixedPriceDeclaredText,
  type OpsFixedPriceDeclaredEmailData,
} from "@/lib/email/ops-transaction-templates";

const base: OpsFixedPriceDeclaredEmailData = {
  leadId: "07234614-127e-47cc-87b1-022034b593a2",
  eventName: "Y2K Party @ APT200",
  quantity: 2,
  amount: 34.6,
  memoHint: "MT-Y2K",
  declaredAt: "2026-09-24T21:49:35.000Z",
  buyerName: "Sam Tremblay",
  buyerEmail: "sam@example.test",
  buyerPhone: "+15140000001",
  buyerInstagram: "samt",
  transactionUrl: "https://mcgilltickets.party/ops#txn-07234614-127e-47cc-87b1-022034b593a2",
};

describe("opsFixedPriceDeclaredSubject", () => {
  it("shouts — all caps, so it reads as urgent in a personal inbox", () => {
    const subject = opsFixedPriceDeclaredSubject(base);
    expect(subject).toBe(subject.toUpperCase());
  });

  it("leads with an emoji so it is findable in a list", () => {
    expect(opsFixedPriceDeclaredSubject(base).startsWith("🚨")).toBe(true);
  });

  it("carries the amount, ticket count and event", () => {
    const subject = opsFixedPriceDeclaredSubject(base);
    expect(subject).toContain("$34.60");
    expect(subject).toContain("2 TICKETS");
    expect(subject).toContain("Y2K PARTY @ APT200");
  });

  it("says one TICKET, not TICKETS", () => {
    expect(opsFixedPriceDeclaredSubject({ ...base, quantity: 1 })).toContain("1 TICKET ");
  });
});

describe("opsFixedPriceDeclaredHtml", () => {
  const html = opsFixedPriceDeclaredHtml(base);

  it("has exactly one link, and it opens the transaction", () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual([base.transactionUrl]);
  });

  it("puts the button above the details", () => {
    expect(html.indexOf("OPEN THIS TRANSACTION")).toBeLessThan(html.indexOf("Buyer"));
  });

  it("shows every detail ops needs to match the payment", () => {
    for (const fragment of [
      "Y2K Party @ APT200",
      "$34.60 CAD",
      "MT-Y2K",
      "Sam Tremblay",
      "sam@example.test",
      "+15140000001",
      "@samt",
      base.leadId,
    ]) {
      expect(html).toContain(fragment);
    }
  });

  it("renders missing contact details as dashes rather than 'null'", () => {
    const sparse = opsFixedPriceDeclaredHtml({
      ...base,
      buyerName: null,
      buyerEmail: null,
      buyerPhone: null,
      buyerInstagram: null,
    });
    expect(sparse).not.toContain("null");
    expect(sparse).toContain("—");
  });

  it("escapes anything a buyer typed", () => {
    const nasty = opsFixedPriceDeclaredHtml({ ...base, buyerName: '<script>alert("x")</script>' });
    expect(nasty).not.toContain("<script>");
    expect(nasty).toContain("&lt;script&gt;");
  });
});

describe("opsFixedPriceDeclaredText", () => {
  it("leads with the link for clients that strip HTML", () => {
    const text = opsFixedPriceDeclaredText(base);
    expect(text.split("\n")[0]).toBe("OPEN THIS TRANSACTION:");
    expect(text.split("\n")[1]).toBe(base.transactionUrl);
  });
});
