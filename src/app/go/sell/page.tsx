import type { Metadata } from "next";
import { QuickSellFlow } from "@/components/beta-quick/sell-flow";
import { loadSavedGoContact } from "@/domains/beta-quick/actions";
import { supportedBetaEvents, tonightBetaEvents } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "I have a ticket to sell · mcgill.tickets",
};

export const dynamic = "force-dynamic";

export default async function QuickSellPage() {
  const tonight = tonightBetaEvents();
  const rest = supportedBetaEvents().filter((e) => !tonight.some((t) => t.slug === e.slug));
  const events = [...tonight, ...rest];
  const savedContact = await loadSavedGoContact();
  return (
    <QuickSellFlow
      events={events.length ? events : supportedBetaEvents()}
      savedContact={savedContact}
    />
  );
}
