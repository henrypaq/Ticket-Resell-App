/**
 * Minimal seller rules for beta “contact me to post” — shown on `/seller-terms`
 * and linked from the sell-contact form. Not a full ToS; key abuse guards only.
 */
export const SELLER_TERMS_PATH = "/seller-terms";

export const SELLER_TERMS = {
  title: "Seller terms",
  intro:
    "By submitting a ticket to mcgill.tickets, you agree to the following.",
  points: [
    "You hold a real, unused ticket for that event. No fakes, altered screenshots, or tickets you don’t own.",
    "The ticket must be valid for the correct date of the event you’re listing — wrong-night tickets are not allowed.",
    "Don’t offer a ticket you’ve already sold, transferred, listed elsewhere, or used for entry.",
    "The screenshot or share link you provide is of your actual ticket and has not been edited to mislead buyers.",
    "Uploading an invalid, fake, already-used, or otherwise misleading ticket will get you banned from the platform.",
    "When we reach out, respond and follow through on the sale. Ghosting after we’ve lined up a buyer can get you removed.",
    "Contact details, prices, and Interac info you give us must be accurate.",
    "We may refuse to post, cancel an arrangement, or ban you if we believe you’ve broken these terms or put buyers at risk.",
    "You’re responsible for completing the transfer to the buyer we match you with; mcgill.tickets facilitates the handoff but is not the event organizer.",
    "mcgill.tickets doesn’t guarantee authenticity until verification ships — your attestation is what the listing rests on.",
  ],
  updated: "2026-09-11",
} as const;
