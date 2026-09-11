import type { Metadata } from "next";
import { QuickBuyFlow } from "@/components/beta-quick/buy-flow";
import { loadSavedGoContact } from "@/domains/beta-quick/actions";
import { betaEventBySlug, goSelectableEvents, type BetaEvent } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "I need a ticket · mcgill.tickets",
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

export default async function QuickBuyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.event;
  const initialEventSlug = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  const fromRaw = params.from;
  const from = typeof fromRaw === "string" ? fromRaw : Array.isArray(fromRaw) ? fromRaw[0] : null;
  const backHref = from === "member" ? "/member" : "/go";

  const events = resolveEvents(initialEventSlug);
  const savedContact = await loadSavedGoContact();

  return (
    <QuickBuyFlow
      events={events}
      savedContact={savedContact}
      initialEventSlug={initialEventSlug}
      backHref={backHref}
    />
  );
}
