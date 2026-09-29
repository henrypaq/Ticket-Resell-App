import { describe, expect, it } from "vitest";
import {
  lifecycleEmail,
  waitlistJoinedEmail,
  type LifecycleEmailArgs,
} from "@/lib/email/user-notification-templates";
import { SERVICE_FEE_LABEL } from "@/lib/compliance/fees";

const TICKET_URL =
  "https://mcgilltickets.party/queue?lead=07234614-127e-47cc-87b1-022034b593a2&event=y2k-party";

const base: LifecycleEmailArgs = {
  eventName: "Y2K Party @ APT200",
  price: 34.6,
  eventSlug: "y2k-party",
  quantity: 2,
  appUrl: "https://mcgilltickets.party",
  ticketUrl: TICKET_URL,
  recipientName: "Sam Tremblay",
  recipientEmail: "sam@example.test",
};

describe("fixed-price payment confirmed", () => {
  const email = lifecycleEmail("fixed_price_paid", base);

  it("confirms the payment and the amount", () => {
    expect(email.subject).toBe("Payment confirmed — Y2K Party @ APT200");
    expect(email.text).toContain("$34.60");
    expect(email.text).toContain("2 tickets");
  });

  it("never talks about holds or claim windows — the buyer already paid", () => {
    for (const body of [email.text, email.html]) {
      expect(body.toLowerCase()).not.toContain("hold");
      expect(body.toLowerCase()).not.toContain("claim");
    }
  });

  it("links to the buyer's own spot", () => {
    expect(email.html).toContain(TICKET_URL.replace(/&/g, "&amp;"));
    expect(email.text).toContain(TICKET_URL);
  });

  it("omits the amount rather than printing $0.00 when none was recorded", () => {
    const noAmount = lifecycleEmail("fixed_price_paid", { ...base, price: 0 });
    expect(noAmount.text).not.toContain("$0.00");
  });
});

describe("fixed-price ticket sent", () => {
  const email = lifecycleEmail("fixed_price_ticket_sent", base);

  it("says where the ticket went and under which name", () => {
    expect(email.text).toContain("sam@example.test");
    expect(email.text).toContain("Sam Tremblay");
  });

  it("links to the ticket", () => {
    expect(email.text).toContain(`Open your ticket: ${TICKET_URL}`);
    expect(email.html).toContain("Open your ticket");
    expect(email.html).toContain(TICKET_URL.replace(/&/g, "&amp;"));
  });

  it("pluralises the subject for a multi-ticket order", () => {
    expect(email.subject).toBe("Your Y2K Party @ APT200 tickets are here");
    expect(lifecycleEmail("fixed_price_ticket_sent", { ...base, quantity: 1 }).subject).toBe(
      "Your Y2K Party @ APT200 ticket is here",
    );
  });

  it("escapes buyer-supplied strings in the HTML", () => {
    const html = lifecycleEmail("fixed_price_ticket_sent", {
      ...base,
      recipientName: "<script>x</script>",
    }).html;
    expect(html).not.toContain("<script>x</script>");
  });

  it("falls back to 'the email on your order' when none is stored", () => {
    const noEmail = lifecycleEmail("fixed_price_ticket_sent", { ...base, recipientEmail: null });
    expect(noEmail.text).toContain("the email on your order");
  });
});

describe("fixed-price copy stays distinct from the resale flow", () => {
  it("does not reuse the waitlist-join wording", () => {
    const waitlist = waitlistJoinedEmail(base);
    for (const kind of ["fixed_price_paid", "fixed_price_ticket_sent"] as const) {
      expect(lifecycleEmail(kind, base).subject).not.toBe(waitlist.subject);
    }
  });

  it("never mentions a fee", () => {
    for (const kind of ["fixed_price_paid", "fixed_price_ticket_sent"] as const) {
      const { text, html } = lifecycleEmail(kind, base);
      expect(text.toLowerCase()).not.toContain("fee");
      expect(html).not.toContain(SERVICE_FEE_LABEL);
    }
  });
});

describe("seller listed on a custody event (Café Campus)", () => {
  const seller: LifecycleEmailArgs = {
    eventName: "Café Campus",
    price: 25,
    eventSlug: "cafe-campus",
    quantity: 1,
    appUrl: "https://mcgilltickets.party",
    transferName: "McGill Tickets",
    transferEmail: "contact@mcgilltickets.party",
  };
  const email = lifecycleEmail("seller_listed_custody", seller);

  it("confirms the posting", () => {
    expect(email.subject).toBe("Posting received — Café Campus");
  });

  it("names the admin account the ticket must be transferred to", () => {
    expect(email.text).toContain("McGill Tickets (contact@mcgilltickets.party)");
    expect(email.html).toContain("contact@mcgilltickets.party");
  });

  it("explains verification and the return path", () => {
    expect(email.text).toContain("admin team verifies");
    expect(email.text).toContain("transfer it back to you");
  });

  it("never mentions a fee", () => {
    expect(email.text.toLowerCase()).not.toContain("fee");
  });
});
