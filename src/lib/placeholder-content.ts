/**
 * Mock content for home-page sections that don't have a real domain behind
 * them yet: "most shared" ranking (needs the share_link_created rollups from
 * DATA_CAPTURE.md), a Venue entity, and a curated-recs algorithm for
 * organizers. The Phase 3 social layer (Follow, AttendanceConfirmation) is
 * real now — see domains/social/data.ts — so "What your friends are into"
 * and "Who I follow" on the home page are no longer here; this file only
 * covers the sections still waiting on a feature that doesn't exist yet.
 */

export type CommunityHighlight = {
  id: string;
  rank: number;
  title: string;
  flyerUrl: string | null;
};

export const communityHighlights: CommunityHighlight[] = [
  { id: "ch-1", rank: 1, title: "Midnight Sessions", flyerUrl: "/flyers/sat.svg" },
  { id: "ch-2", rank: 2, title: "Bass Coast Warmup", flyerUrl: "/flyers/belmont.svg" },
  { id: "ch-3", rank: 3, title: "Analog Nights", flyerUrl: "/flyers/datcha.svg" },
  { id: "ch-4", rank: 4, title: "Low End Theory MTL", flyerUrl: "/flyers/ritz.svg" },
  { id: "ch-5", rank: 5, title: "Sunday Sessions", flyerUrl: "/flyers/ateliers.svg" },
];

export type PlaceholderVenue = {
  id: string;
  name: string;
  neighborhood: string;
};

export const topVenues: PlaceholderVenue[] = [
  { id: "v-1", name: "MTELUS", neighborhood: "Quartier des Spectacles" },
  { id: "v-2", name: "Le Belmont", neighborhood: "Mile End" },
  { id: "v-3", name: "Datcha", neighborhood: "Plateau" },
  { id: "v-4", name: "Société des Arts Technologiques", neighborhood: "Quartier des Spectacles" },
];

export type OrganizerRec = {
  id: string;
  name: string;
  handle: string | null;
  blurb: string;
};

export const organizerRecs: OrganizerRec[] = [
  { id: "or-1", name: "Nightshift Collective", handle: "nightshiftmtl", blurb: "Underground techno, always at odd venues." },
  { id: "or-2", name: "Piknic Électronik", handle: "piknicelectronik", blurb: "Outdoor daytime sets all summer." },
  { id: "or-3", name: "Sofar Sounds Montreal", handle: "sofarmtl", blurb: "Secret-location acoustic shows." },
];
