import type { Metadata } from "next";
import { QuickBuyFlow } from "@/components/beta-quick/buy-flow";
import { loadSavedGoContact } from "@/domains/beta-quick/actions";
import { supportedBetaEvents, tonightBetaEvents } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "I need a ticket · mcgill.tickets",
};

export const dynamic = "force-dynamic";

export default async function QuickBuyPage() {
  const tonight = tonightBetaEvents();
  const rest = supportedBetaEvents().filter((e) => !tonight.some((t) => t.slug === e.slug));
  const events = [...tonight, ...rest];
  const savedContact = await loadSavedGoContact();
  return (
    <QuickBuyFlow
      events={events.length ? events : supportedBetaEvents()}
      savedContact={savedContact}
    />
  );
}
