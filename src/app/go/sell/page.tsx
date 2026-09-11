import type { Metadata } from "next";
import { QuickSellFlow } from "@/components/beta-quick/sell-flow";
import { loadSavedGoContact } from "@/domains/beta-quick/actions";
import { goSelectableEvents } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "I have a ticket to sell · mcgill.tickets",
};

export const dynamic = "force-dynamic";

export default async function QuickSellPage() {
  const events = goSelectableEvents();
  const savedContact = await loadSavedGoContact();
  return <QuickSellFlow events={events} savedContact={savedContact} />;
}
