import type { Metadata } from "next";
import { AppHome } from "@/components/app/home";
import { JoinFlow } from "@/components/app/join-flow";
import { initialsFromName } from "@/components/app/header";
import { AppShell } from "@/components/app/shell";
import { loadGoActivityForHub, loadQuickWaitlistForHub } from "@/domains/beta-quick/actions";
import { loadBetaProfile } from "@/domains/beta-signup/actions";
import { currentNightlifeWeekday, tonightBetaEvents } from "@/lib/beta-events";
import { demoLoginEnabled } from "@/lib/env";

export const metadata: Metadata = {
  title: "Buy & sell tickets · mcgill.tickets",
  description: "Need a sold-out ticket or have one to sell? Montreal nights, matched fast.",
};

export const dynamic = "force-dynamic";

/**
 * The app. Joining as a beta member is the gate: no member cookie, no app.
 * Once in, home shows tonight in Montreal nightlife time (pre-6am still counts
 * as the previous night) plus whatever this person already has going — their
 * waitlist spots and the tickets they've listed.
 */
export default async function HomePage() {
  const profile = await loadBetaProfile();
  if (!profile) {
    return <JoinFlow showDevSkip={demoLoginEnabled()} />;
  }

  const [waitlist, activity] = await Promise.all([
    loadQuickWaitlistForHub(),
    loadGoActivityForHub(),
  ]);

  return (
    <AppShell initials={initialsFromName(profile.name)}>
      <AppHome
        tonight={tonightBetaEvents()}
        tonightDay={currentNightlifeWeekday()}
        waitlist={waitlist}
        activity={activity}
      />
    </AppShell>
  );
}
