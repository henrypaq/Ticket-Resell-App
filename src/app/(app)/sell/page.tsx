import Link from "next/link";
import { listResaleEnabledEvents } from "@/domains/events/data";
import { requireSessionUser } from "@/domains/users/session";
import { getTierAProvider } from "@/lib/verification/tier-a-providers";
import type { SourcePlatform } from "@/domains/events/source-parser";
import { SellForm } from "./sell-form";
import { ArrowLeft } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Post a ticket · Passe" };

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; scannedBarcode?: string }>;
}) {
  await requireSessionUser();
  const { event, scannedBarcode } = await searchParams;
  // Only resale_enabled events are offered here — the same rule the database
  // trigger and the create-listing service both enforce (CLAUDE.md § Phase 1).
  const events = await listResaleEnabledEvents();

  return (
    <main className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <Link
        href="/"
        aria-label="Back"
        className="pill flex h-11 w-11 items-center justify-center text-ink"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <h1 className="headline mt-5 text-[28px] leading-tight">Post a ticket</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
        Pick the event, confirm you actually hold the ticket, and set a price at or below what you
        paid. That cap is not adjustable.
      </p>

      <div className="mt-7">
        <SellForm
          events={events.map((e) => {
            const provider = getTierAProvider(e.source_platform as SourcePlatform);
            return {
              id: e.id,
              name: e.name,
              venue: e.venue,
              originalPrice: Number(e.original_price),
              // Matches domains/listings/service.ts's createListing gate exactly:
              // a real, configured Tier A provider is the only thing that skips
              // barcode evidence — not the verification_tier label.
              requiresTicketEvidence: !provider || !provider.configured(),
            };
          })}
          defaultEventId={event}
          defaultTicketBarcode={scannedBarcode}
        />
      </div>

      <div className="surface mt-8 rounded-2xl p-4">
        <h2 className="text-[15px] font-bold">Don&apos;t see your event?</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          Send us a link to the event page and we&apos;ll review it — usually within a day. Every
          event is checked by an admin before anyone can list a ticket against it.
        </p>
        <Link
          href="/sell/request-event"
          className="mt-3 inline-flex rounded-full border border-hairline px-4 py-2 text-[13.5px] font-semibold"
        >
          Request an event
        </Link>
      </div>
    </main>
  );
}
