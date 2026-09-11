import type { Metadata } from "next";
import { ACQUISITION_LANDING } from "@/lib/beta-acquisition";

export const metadata: Metadata = {
  title: "Buy & sell · mcgilltickets.party",
  description: "Scan to buy or sell sold-out tickets on mcgill.tickets.",
  robots: { index: false, follow: false },
};

/**
 * Branded QR share screen for the low-friction `/go` flow. The QR encodes
 * `/go?src=qr_share` so scans attribute correctly; the visible label stays the
 * clean domain. Plain printable QR: `/qr/go-qr-print.png`.
 */
export default function GoQrDisplayPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-base px-5 py-12 text-center sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(55% 60% at 50% 0%, rgba(255,229,0,0.14) 0%, rgba(255,229,0,0.04) 45%, transparent 75%)",
        }}
      />

      <div className="relative flex w-full max-w-lg flex-col items-center">
        <p className="text-[17px] font-semibold text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-4 text-[34px] leading-[1.12] tracking-tight sm:text-[44px]">
          DON&apos;T PANIC IF TICKETS ARE SOLD OUT
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Scan to buy or sell sold-out tickets — Café Campus, Piknik, and more
        </p>

        <div className="mt-8 w-full rounded-[28px] bg-[#1a1a1d] p-4 sm:p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/qr/go-qr-share.png"
            alt="QR code linking to mcgilltickets.party buy and sell"
            className="aspect-square w-full"
          />
        </div>

        <p className="mt-6 text-[14px] font-semibold text-[#ffe500]">www.mcgilltickets.party</p>
      </div>

      <p className="sr-only">{ACQUISITION_LANDING.go_qr_share}</p>
    </main>
  );
}
