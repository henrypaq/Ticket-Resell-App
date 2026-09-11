import type { Metadata } from "next";
import Link from "next/link";
import {
  FLYER_ACQUISITION_CHANNELS,
  FLYER_ACQUISITION_LABELS,
  flyerLandingUrl,
} from "@/lib/beta-acquisition";

export const metadata: Metadata = {
  title: "Flyer QRs · mcgill.tickets",
  robots: { index: false, follow: false },
};

/**
 * Index of Café Campus flyer QR screenshot pages (inverted for yellow stock).
 */
export default function FlyerQrIndexPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 py-12">
      <div>
        <p className="text-[13px] font-semibold text-[#ffe500]">mcgill.tickets</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-ink">
          Flyer QR codes
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          White-on-black QRs for yellow flyers. Each scan tags the user with that
          flyer&apos;s source.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {FLYER_ACQUISITION_CHANNELS.map((channel) => (
          <li key={channel}>
            <Link
              href={`/qr/flyer/${channel}`}
              className="flex items-center justify-between rounded-[16px] border border-hairline bg-white/[0.04] px-4 py-4 text-left transition-colors hover:bg-white/[0.07]"
            >
              <span>
                <span className="block text-[15px] font-semibold text-ink">
                  {FLYER_ACQUISITION_LABELS[channel]}
                </span>
                <span className="mt-0.5 block font-mono text-[12px] text-muted">{channel}</span>
              </span>
              <span className="text-[13px] font-semibold text-[#ffe500]">Open →</span>
            </Link>
            <p className="mt-1.5 px-1 font-mono text-[11px] text-muted/80">
              {flyerLandingUrl(channel)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
