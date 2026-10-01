import type { Metadata } from "next";
import { AppHome } from "@/components/app/home";
import { initialsFromName } from "@/components/app/header";
import { AppShell } from "@/components/app/shell";
import { loadGoActivityForHub, loadQuickWaitlistForHub } from "@/domains/beta-quick/actions";
import { loadBetaProfile } from "@/domains/beta-signup/actions";
import { getTonightBetaEvents } from "@/domains/beta-events/catalog";
import { listedCountsBySlug } from "@/domains/beta-matching/service";
import { currentNightlifeWeekday } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "Buy & sell tickets · mcgill.tickets",
  description: "Need a sold-out ticket or have one to sell? Montreal nights, matched fast.",
};

export const dynamic = "force-dynamic";

/**
 * The app. No sign-up wall — the link in the Instagram bio lands here and you
 * can start a buy or sell flow immediately; saving a profile is offered at the
 * end of a flow instead (see `SaveProfileCard`).
 *
 * Home shows tonight in Montreal nightlife time (pre-6am still counts as the
 * previous night) plus whatever this visitor already has going — their
 * waitlist spots and the tickets they've listed, matched by cookie or, once
 * they've saved a profile, by member id.
 */
export default async function HomePage() {
  const [profile, waitlist, activity, tonight] = await Promise.all([
    loadBetaProfile(),
    loadQuickWaitlistForHub(),
    loadGoActivityForHub(),
    getTonightBetaEvents(),
  ]);
  const listedBySlug = await listedCountsBySlug(tonight.map((event) => event.slug));

  return (
    <AppShell initials={initialsFromName(profile?.name)}>
      <AppHome
        tonight={tonight}
        tonightDay={currentNightlifeWeekday()}
        waitlist={waitlist}
        activity={activity}
        listedBySlug={listedBySlug}
      />
    </AppShell>
  );
}
