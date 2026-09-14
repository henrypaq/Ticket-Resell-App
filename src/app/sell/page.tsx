import type { Metadata } from "next";
import { QuickSellFlow } from "@/components/app/sell-flow";
import { loadSavedGoContact } from "@/domains/beta-quick/actions";
import { requireMember } from "@/domains/beta-signup/gate";
import { betaEventBySlug, goSelectableEvents, type BetaEvent } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "I have a ticket to sell · mcgill.tickets",
};

export const dynamic = "force-dynamic";

function resolveEvents(initialEventSlug: string | null): BetaEvent[] {
  const base = goSelectableEvents();
  if (!initialEventSlug) return base;
  const preset = betaEventBySlug(initialEventSlug);
  if (!preset) return base;
  if (base.some((e) => e.slug === preset.slug)) return base;
  return [preset, ...base];
}

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireMember();

  const params = await searchParams;
  const raw = params.event;
  const initialEventSlug = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

  const events = resolveEvents(initialEventSlug);
  const savedContact = await loadSavedGoContact();

  return (
    <QuickSellFlow
      events={events}
      savedContact={savedContact}
      initialEventSlug={initialEventSlug}
    />
  );
}
