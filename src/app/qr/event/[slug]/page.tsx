import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBetaEventBySlug } from "@/domains/beta-events/catalog";
import { fixedPriceBreakdown } from "@/lib/compliance/fixed-price";
import { nightlifeDateKey } from "@/lib/beta-events";
import { brandedQrDataUrl } from "@/lib/qr-code";
import { campaignQrSrc, eventBuyUrl } from "@/lib/event-qr";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getBetaEventBySlug(slug);
  return {
    title: event ? `${event.name} · Scan to buy` : "Event QR",
    robots: { index: false, follow: false },
  };
}

/**
 * Scan-me poster for one event, sized for a phone held up in a room.
 *
 * Everything on it is read from the catalog at request time — name, discount,
 * price — so editing the event in /ops/events changes the poster rather than
 * leaving a stale number on a screen someone is holding up at a door.
 *
 * The QR encodes `/buy?event=<slug>&src=qr_<slug>`, so scans are attributed as
 * their own campaign in `beta_campaign_link_opens` and last-touch, separately
 * from stories and flyers.
 */
export default async function EventQrPage({ params }: Props) {
  const { slug } = await params;
  const event = await getBetaEventBySlug(slug);
  if (!event || !event.supported) notFound();

  const url = eventBuyUrl(event.slug);
  const qr = await brandedQrDataUrl(url, 1400);
  const price = fixedPriceBreakdown(event, 1);

  const nightKey = event.extraDateKeys?.[0] ?? null;
  const isTonight = nightKey != null && nightKey === nightlifeDateKey();
  const dateLabel = isTonight
    ? "Tonight"
    : nightKey
      ? new Date(`${nightKey}T12:00:00Z`).toLocaleDateString("en-CA", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "America/Toronto",
        })
      : (event.days[0] ?? null);

  const discountHeadline =
    price.showDiscount && price.discountLabel
      ? price.discountLabel
      : price.showDiscount
        ? `Save $${price.discountEach.toFixed(2)}`
        : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#fbbf24] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-[#0b0b0c]">
      {/* Centred as one stack rather than pinned top-and-bottom: a square code
          can never be more than a phone is wide, so the way to make it dominant
          is to close the gaps around it, not to stretch it. */}
      <div className="flex w-full max-w-[560px] flex-col items-center gap-4">
        {/* ── Headlines ──────────────────────────────────────────────── */}
        <header className="w-full text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#0b0b0c]/60">
            mcgill.tickets
          </p>

          {/* Scales with the viewport and breaks anywhere: event names run from
              "Stereo" to "Y2K Party @ APT200" and a clipped title on a poster
              someone is holding up is worse than a smaller one. */}
          <h1 className="headline mt-2 text-[clamp(26px,7.4vw,44px)] font-semibold uppercase leading-[0.95] tracking-tight [overflow-wrap:anywhere] text-balance">
            {event.name}
          </h1>

          {discountHeadline && (
            <p className="mt-3 inline-flex items-center rounded-full bg-[#0b0b0c] px-4 py-1.5 text-[15px] font-bold uppercase tracking-[0.08em] text-[#fbbf24] sm:text-[17px]">
              {discountHeadline}
            </p>
          )}

          <p className="mt-2.5 text-[14px] font-semibold text-[#0b0b0c]/70 sm:text-[15px]">
            {[dateLabel, event.venue].filter(Boolean).join(" · ")}
          </p>
        </header>

        {/* ── The code, given every pixel that's left ────────────────── */}
        <div className="flex w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`QR code linking to tickets for ${event.name}`}
            width={1400}
            height={1400}
            className="aspect-square w-full max-w-[min(100%,68vh)] select-none"
            draggable={false}
          />
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="w-full text-center">
          <p className="text-[19px] font-bold uppercase tracking-[0.06em] sm:text-[22px]">
            Scan to grab a ticket
          </p>
          <p className="mt-1 text-[14px] font-semibold text-[#0b0b0c]/70">
            ${price.grandTotal.toFixed(2)} all in
            {price.showDiscount ? (
              <span className="ml-1.5 font-normal line-through opacity-55">
                ${price.listSubtotal.toFixed(2)}
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 break-all font-mono text-[11px] leading-snug text-[#0b0b0c]/50">
            mcgilltickets.party · {campaignQrSrc(event.slug)}
          </p>
        </footer>
      </div>
    </main>
  );
}
