import type { Metadata } from "next";
import { QuickSellFlow } from "@/components/beta-quick/sell-flow";
import { loadSavedGoContact } from "@/domains/beta-quick/actions";
import { goSelectableEvents } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "I have a ticket to sell · mcgill.tickets",
};

export const dynamic = "force-dynamic";

export default async function QuickSellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const events = goSelectableEvents();
  const savedContact = await loadSavedGoContact();
  const params = await searchParams;
  const raw = params.event;
  const initialEventSlug = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

  return (
    <QuickSellFlow
      events={events}
      savedContact={savedContact}
      initialEventSlug={initialEventSlug}
    />
  );
}
