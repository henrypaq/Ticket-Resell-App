import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  FLYER_ACQUISITION_CHANNELS,
  FLYER_ACQUISITION_LABELS,
  flyerLandingUrl,
  isFlyerAcquisitionChannel,
  type FlyerAcquisitionChannel,
} from "@/lib/beta-acquisition";
import { invertedQrDataUrl } from "@/lib/qr-code";

type Props = { params: Promise<{ channel: string }> };

export function generateStaticParams() {
  return FLYER_ACQUISITION_CHANNELS.map((channel) => ({ channel }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channel } = await params;
  if (!isFlyerAcquisitionChannel(channel)) return { title: "Flyer QR" };
  return {
    title: `${FLYER_ACQUISITION_LABELS[channel]} QR · mcgill.tickets`,
    robots: { index: false, follow: false },
  };
}

/**
 * Screenshot page: inverted (white-on-black) QR for yellow flyer backgrounds.
 * Encodes `/go?src=<channel>` so first-touch acquisition is stamped on scan.
 */
export default async function FlyerQrPage({ params }: Props) {
  const { channel: raw } = await params;
  if (!isFlyerAcquisitionChannel(raw)) notFound();
  const channel = raw as FlyerAcquisitionChannel;
  const url = flyerLandingUrl(channel);
  const qr = await invertedQrDataUrl(url, 1200);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-black px-4 py-10 text-center">
      <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.14em] text-white/55">
        {FLYER_ACQUISITION_LABELS[channel]} · {channel}
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qr}
        alt={`QR code for ${channel}`}
        width={720}
        height={720}
        className="aspect-square w-full max-w-[720px] select-none"
        draggable={false}
      />

      <p className="mt-5 max-w-[720px] break-all font-mono text-[11px] leading-relaxed text-white/40">
        {url}
      </p>
      <p className="mt-2 text-[12px] text-white/35">
        Screenshot the QR only — yellow flyer stock · white on black
      </p>
    </main>
  );
}
