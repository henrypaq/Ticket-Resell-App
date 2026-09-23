import type { Metadata } from "next";
import { QuickSellFlow } from "@/components/app/sell-flow";
import { loadSavedGoContact } from "@/domains/beta-quick/actions";
import { getBoardSelectableEvents } from "@/domains/beta-events/catalog";

export const metadata: Metadata = {
  title: "I have a ticket to sell · mcgill.tickets",
};

export const dynamic = "force-dynamic";

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.event;
  const requested = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

  const events = await getBoardSelectableEvents();
  const lockedSlug =
    requested && events.some((e) => e.slug === requested) ? requested : null;
  const savedContact = await loadSavedGoContact();
  const { platformTicketTransfer } = await import("@/lib/env");

  return (
    <QuickSellFlow
      events={events}
      savedContact={savedContact}
      initialEventSlug={lockedSlug}
      cafeTransfer={platformTicketTransfer()}
    />
  );
}
