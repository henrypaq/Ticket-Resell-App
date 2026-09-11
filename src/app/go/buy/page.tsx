import type { Metadata } from "next";
import { QuickBuyFlow } from "@/components/beta-quick/buy-flow";
import { supportedBetaEvents, tonightBetaEvents } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "I need a ticket · mcgill.tickets",
};

export const dynamic = "force-dynamic";

export default function QuickBuyPage() {
  const tonight = tonightBetaEvents();
  const rest = supportedBetaEvents().filter((e) => !tonight.some((t) => t.slug === e.slug));
  // Tonight first, then the rest — pick any supported event.
  const events = [...tonight, ...rest];
  return <QuickBuyFlow events={events.length ? events : supportedBetaEvents()} />;
}
