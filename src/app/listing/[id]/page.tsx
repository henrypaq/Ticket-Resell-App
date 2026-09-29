import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SellerJourneyScreen, SellerJourneyUnavailable } from "@/components/app/seller-journey";
import { loadProfilePrefill, loadSellListingForSeller } from "@/domains/beta-quick/actions";
import { loadBetaProfile } from "@/domains/beta-signup/actions";
import { getBetaEventBySlug } from "@/domains/beta-events/catalog";
import { platformTicketTransfer } from "@/lib/env";

export const metadata: Metadata = {
  title: "Your listing · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** A seller's journey for one listing — opened from the home "for sale" rail. */
export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const listing = await loadSellListingForSeller(id);
  if (!listing) return <SellerJourneyUnavailable />;

  const event = await getBetaEventBySlug(listing.entry.eventSlug);

  // Straight from the sell flow with no profile: offer account setup here,
  // the job the old /done confirmation did.
  let accountSetup = null;
  if (isNew === "1" && !(await loadBetaProfile())) {
    const prefill = await loadProfilePrefill();
    if (prefill) {
      const setupPath = `/setup?${new URLSearchParams({ intent: "sell", next: `/listing/${id}` }).toString()}`;
      accountSetup = { prefill, setupPath };
    }
  }

  return (
    <SellerJourneyScreen
      entry={listing.entry}
      waitingBuyers={listing.waitingBuyers}
      venueLine={event ? `${event.venue} · ${event.city}` : null}
      custody={platformTicketTransfer()}
      accountSetup={accountSetup}
    />
  );
}
