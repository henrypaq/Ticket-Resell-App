import type { Metadata } from "next";
import { QuickBuyFlow } from "@/components/beta-quick/buy-flow";
import { loadSavedGoContact } from "@/domains/beta-quick/actions";
import { goSelectableEvents } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "I need a ticket · mcgill.tickets",
};

export const dynamic = "force-dynamic";

export default async function QuickBuyPage() {
  const events = goSelectableEvents();
  const savedContact = await loadSavedGoContact();
  return <QuickBuyFlow events={events} savedContact={savedContact} />;
}
