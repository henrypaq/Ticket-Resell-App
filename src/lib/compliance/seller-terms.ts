/**
 * Minimal seller rules for beta “contact me to post” — shown on `/seller-terms`
 * and linked from the sell-contact form. Not a full ToS; key abuse guards only.
 */
export const SELLER_TERMS_PATH = "/seller-terms";

export const SELLER_TERMS = {
  title: "Seller terms",
  intro:
    "By asking mcgill.tickets to contact you to post a ticket, you agree to the following.",
  points: [
    "You must hold a real, unused ticket for that event. No fakes, altered screenshots, or tickets you don’t own.",
    "Don’t offer a ticket you’ve already sold, transferred, listed elsewhere, or used for entry.",
    "When we reach out, respond and follow through on the sale. Ghosting after we’ve lined up a buyer can get you removed from the beta.",
    "Contact details and ticket info you give us must be accurate.",
    "We may refuse to post, cancel an arrangement, or ban you if we believe you’ve broken these terms or put buyers at risk.",
    "mcgill.tickets is a beta facilitation channel — not the event organizer. We don’t guarantee authenticity until verification ships.",
  ],
  updated: "2026-09-10",
} as const;
