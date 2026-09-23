import type { Metadata } from "next";
import { AppHome } from "@/components/app/home";
import { initialsFromName } from "@/components/app/header";
import { AppShell } from "@/components/app/shell";
import { loadGoActivityForHub, loadQuickWaitlistForHub } from "@/domains/beta-quick/actions";
import { loadBetaProfile } from "@/domains/beta-signup/actions";
import { getTonightBetaEvents } from "@/domains/beta-events/catalog";
import { currentNightlifeWeekday } from "@/lib/beta-events";
import { platformTicketTransfer } from "@/lib/env";

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

  return (
    <AppShell initials={initialsFromName(profile?.name)}>
      <AppHome
        tonight={tonight}
        tonightDay={currentNightlifeWeekday()}
        waitlist={waitlist}
        activity={activity}
        cafeTransfer={platformTicketTransfer()}
      />
    </AppShell>
  );
}
