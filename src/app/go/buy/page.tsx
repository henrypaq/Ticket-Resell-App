import type { Metadata } from "next";
import { QuickBuyFlow } from "@/components/beta-quick/buy-flow";
import { loadSavedGoContact } from "@/domains/beta-quick/actions";
import { goSelectableEvents } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "I need a ticket · mcgill.tickets",
};

export const dynamic = "force-dynamic";

export default async function QuickBuyPage({
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
    <QuickBuyFlow
      events={events}
      savedContact={savedContact}
      initialEventSlug={initialEventSlug}
    />
  );
}
