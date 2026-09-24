/**
 * Shared look for form fields and CTAs across the app shell.
 * Dark grey fill, no border, lightly rounded (not a pill).
 */
export const FIELD_RADIUS = "rounded-[14px]";

export const FIELD_CLASS =
  `w-full ${FIELD_RADIUS} border-0 bg-[#1a1a1d] px-5 py-4 text-[16px] text-ink outline-none placeholder:text-muted/70 focus:bg-[#222226]`;

/**
 * For a compound field (e.g. country-code + number) — no horizontal padding,
 * children own their own. Deliberately NOT `overflow-hidden`: the country
 * dropdown's popup is an absolutely-positioned child of this container.
 */
export const FIELD_GROUP_CLASS =
  `flex items-center ${FIELD_RADIUS} border-0 bg-[#1a1a1d] transition-colors focus-within:bg-[#222226]`;

/**
 * Primary CTA — solid brand yellow, no border. UI face.
 */
export const BUTTON_CLASS =
  `font-ui flex min-h-[52px] items-center justify-center gap-2 ${FIELD_RADIUS} border-0 bg-[#ffe500] px-8 py-4 text-[15px] font-semibold tracking-tight text-black transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35`;

export const BUTTON_CLASS_COMPACT =
  `font-ui flex min-h-[48px] items-center justify-center self-end ${FIELD_RADIUS} border-0 bg-[#ffe500] px-8 text-[14px] font-semibold tracking-tight text-black transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35`;

/**
 * Secondary CTA — solid elevated surface, no outline border.
 */
export const SECONDARY_BUTTON_CLASS =
  `font-ui flex items-center justify-center ${FIELD_RADIUS} border-0 bg-[#f5f5f5] px-8 font-semibold tracking-tight text-[#0b0b0c] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35`;
