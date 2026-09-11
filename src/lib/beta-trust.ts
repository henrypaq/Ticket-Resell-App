/**
 * Buyer/seller trust copy for the low-friction `/go` flow.
 * Keep tone calm and specific — no scare headlines.
 */

export const GO_TRUST = {
  hub: {
    label: "Protected payments",
    body: "Verified tickets before money moves. If something goes wrong with a purchase, we cover 100% of the ticket price.",
  },
  buyJoin: {
    label: "Buyer protection",
    body: "We confirm tickets before you pay. If there’s a problem with the payment, we cover 100% of what you paid.",
  },
  sellSubmit: {
    label: "Secure payout",
    body: "Buyers pay through us. You’re paid after the ticket and transfer check out — no off-platform deals.",
  },
  buyDone: {
    label: "You’re covered",
    body: "If a payment issue comes up, we make it right for the full ticket price.",
  },
  sellDone: {
    label: "Verified listings",
    body: "We check every ticket before matching a buyer, so both sides stay protected.",
  },
} as const;
