import type { Metadata } from "next";
import { QuickHub } from "@/components/beta-quick/hub";
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
 * Low-friction beta hub for Instagram bio — tonight's events + buy/sell CTAs.
 * Separate from the long questionnaire at `/`.
 */
export default function QuickGoPage() {
  const tonight = tonightBetaEvents();
  const day = currentBetaWeekday();
  const other = supportedBetaEvents().filter((e) => !tonight.some((t) => t.slug === e.slug));

  return <QuickHub tonight={tonight} tonightDay={day} otherEvents={other.length ? other : supportedBetaEvents()} />;
}
