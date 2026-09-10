/**
 * Events shown on the beta waitlist's final screen. Deliberately NOT a row in
 * `public.events` — that table drives the real resale-enabled listing flow
 * (pending/resale_enabled status, price-cap machinery, § hard constraints),
 * none of which applies to a "here's what's coming" preview card. Add rows
 * here as more venues come online; promote one to a real `events` row only
 * once listings should actually be postable against it.
 */
export type BetaEvent = {
  slug: string;
  name: string;
  venue: string;
  city: string;
  blurb: string;
  /** Poster art for the events-tab card — full-bleed, same convention as the real app's flyer_url. */
  flyerUrl: string;
  /**
   * Weeknight(s) this card belongs under. List headers are one day at a time —
   * a multi-day event is listed once under each of its days.
   */
  days: BetaWeekday[];
  /** When false, shown only as interest options / request targets, not live. */
  supported: boolean;
};

export const BETA_WEEKDAYS = [
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
] as const;

export type BetaWeekday = (typeof BETA_WEEKDAYS)[number];

export const BETA_EVENTS: BetaEvent[] = [
  {
    slug: "cafe-campus",
    name: "Café Campus",
    venue: "Café Campus",
    city: "Montreal",
    blurb:
      "The first venue we're supporting — post a ticket you can't use, or join the waiting list and we'll reach out when one drops.",
    flyerUrl: "/flyers/cafe-campus.jpg",
    days: ["Thursday", "Friday", "Saturday"],
    supported: true,
  },
  {
    slug: "montreal-frosh-muzique",
    name: "Montreal Frosh Night @ Muzique",
    venue: "Muzique",
    city: "Montreal",
    blurb: "Frosh night at Muzique — join the waitlist or let us know you've got an extra.",
    flyerUrl: "/flyers/sat.svg",
    days: ["Thursday"],
    supported: true,
  },
  {
    slug: "niska-bell-center",
    name: "Niska @ Bell Center",
    venue: "Bell Centre",
    city: "Montreal",
    blurb: "Niska at the Bell Centre — we'll ping you when a ticket drops.",
    flyerUrl: "/flyers/mtelus.svg",
    days: ["Saturday"],
    supported: true,
  },
  {
    slug: "piknik-electronik",
    name: "Piknik Électronik",
    venue: "Parc Jean-Drapeau",
    city: "Montreal",
    blurb: "Sunday Piknik — join the waitlist or post a ticket you can't use.",
    flyerUrl: "/flyers/piknic.svg",
    days: ["Sunday"],
    supported: true,
  },
];

export function supportedBetaEvents(): BetaEvent[] {
  return BETA_EVENTS.filter((e) => e.supported);
}

export function betaEventBySlug(slug: string): BetaEvent | undefined {
  return BETA_EVENTS.find((e) => e.slug === slug);
}

/** Next calendar date for a weekday name, including today if it matches. */
export function nextDateForWeekday(day: BetaWeekday, from: Date = new Date()): Date {
  const target = (
    ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
  ).indexOf(day);
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  const delta = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** e.g. "Thursday - September 10th" */
export function formatBetaEventWhen(day: BetaWeekday, from: Date = new Date()): string {
  const d = nextDateForWeekday(day, from);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday} - ${month} ${ordinal(d.getDate())}`;
}

/** Options shown on the "which events are you interested in" step. */
export const INTEREST_OPTIONS = [
  { value: "cafe-campus", label: "Café Campus" },
  { value: "montreal-frosh-muzique", label: "Montreal Frosh Night @ Muzique" },
  { value: "niska-bell-center", label: "Niska @ Bell Center" },
  { value: "piknik-electronik", label: "Piknik Électronik" },
  { value: "belmont", label: "Belmont" },
  { value: "stereo", label: "Stereo" },
  { value: "new-city-gas", label: "New City Gas" },
  { value: "names", label: "Names" },
  { value: "montreal-frosh-week", label: "Montreal Frosh Week" },
] as const;

/** Public socials for the beta shell header. Swap URLs when handles are final. */
export const BETA_SOCIALS = {
  instagram: "https://www.instagram.com/passe.mtl/",
  snapchat: "https://www.snapchat.com/add/passe.mtl",
} as const;
