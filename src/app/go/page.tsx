import type { Metadata } from "next";
import { QuickHub } from "@/components/beta-quick/hub";
import { loadQuickWaitlistForHub } from "@/domains/beta-quick/actions";
import {
  currentBetaWeekday,
  supportedBetaEvents,
  tonightBetaEvents,
} from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "Buy & sell tickets · mcgill.tickets",
  description: "Need a sold-out ticket or have one to sell? Quick beta for Montreal nights.",
};

export const dynamic = "force-dynamic";

/**
 * Low-friction beta hub for Instagram bio — tonight's events (Montreal date)
 * + buy/sell CTAs. Recomputes each request so the night flips with the calendar.
 */
export default async function QuickGoPage() {
  const tonight = tonightBetaEvents();
  const day = currentBetaWeekday();
  const other = supportedBetaEvents().filter((e) => !tonight.some((t) => t.slug === e.slug));
  const waitlist = await loadQuickWaitlistForHub();

  return (
    <QuickHub
      tonight={tonight}
      tonightDay={day}
      otherEvents={other.length ? other : supportedBetaEvents()}
      waitlist={waitlist}
    />
  );
}
