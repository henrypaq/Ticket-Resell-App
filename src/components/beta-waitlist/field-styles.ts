/**
 * Shared look for actual form fields across the waitlist + beta shell —
 * dark grey fill, no border, lightly rounded (not a pill). Distinct from
 * `.pill` which stays for chips/tags/icon buttons elsewhere.
 */
export const FIELD_RADIUS = "rounded-[14px]";

export const FIELD_CLASS =
  `w-full ${FIELD_RADIUS} border-0 bg-[#1a1a1d] px-5 py-4 text-[16px] text-ink outline-none placeholder:text-muted/70 focus:bg-[#222226]`;

/**
 * For a compound field (e.g. country-code + number) — no horizontal padding,
 * children own their own. Deliberately NOT `overflow-hidden`: the country
 * dropdown's popup is an absolutely-positioned child of this container, and
 * clipping overflow here clips the popup to invisible along with it.
 */
export const FIELD_GROUP_CLASS =
  `flex items-center ${FIELD_RADIUS} border-0 bg-[#1a1a1d] transition-colors focus-within:bg-[#222226]`;

/**
 * Primary CTA — same corner radius as fields. Dimmed (opacity only) while
 * disabled / not yet clickable so it doesn't read as active.
 */
export const BUTTON_CLASS =
  `flex min-h-[52px] items-center justify-center gap-2 ${FIELD_RADIUS} bg-[#ffe500] px-8 py-4 text-[15px] font-bold text-black transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35`;

export const BUTTON_CLASS_COMPACT =
  `flex min-h-[48px] items-center justify-center self-end ${FIELD_RADIUS} bg-[#ffe500] px-8 text-[14px] font-bold text-black transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35`;
