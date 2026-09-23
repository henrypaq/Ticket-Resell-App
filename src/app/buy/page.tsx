import type { Metadata } from "next";
import { QuickBuyFlow } from "@/components/app/buy-flow";
import { loadSavedGoContact } from "@/domains/beta-quick/actions";
import { getBoardSelectableEvents } from "@/domains/beta-events/catalog";

export const metadata: Metadata = {
  title: "I need a ticket · mcgill.tickets",
};

export const dynamic = "force-dynamic";

export default async function BuyPage({
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

  return (
    <QuickBuyFlow
      events={events}
      savedContact={savedContact}
      initialEventSlug={lockedSlug}
    />
  );
}
