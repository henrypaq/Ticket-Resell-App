import type { Metadata } from "next";
import { ACQUISITION_LANDING } from "@/lib/beta-acquisition";

export const metadata: Metadata = {
  title: "Join the beta · mcgilltickets.party",
  description: "Scan to join the mcgilltickets.party beta waitlist.",
  robots: { index: false, follow: false },
};

/**
 * Branded QR share screen for mobile / Stories. The QR encodes
 * `?src=qr_share` so scans attribute correctly; the visible label stays the
 * clean domain. Plain printable QR: `/qr/beta-signup-qr-print.png`.
 */
export default function QrDisplayPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-base px-6 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(55% 60% at 50% 0%, rgba(255,229,0,0.14) 0%, rgba(255,229,0,0.04) 45%, transparent 75%)",
        }}
      />

      <p className="relative section-header text-[12px] tracking-[0.12em] text-[#ffe500]">Beta</p>
      <h1 className="relative headline mt-4 max-w-xl text-[34px] leading-[1.12] tracking-tight sm:text-[44px]">
        DON&apos;T PANIC IF TICKETS ARE SOLD OUT
      </h1>
      <p className="relative mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
        Scan to join the waitlist — beta members get priority access on launch.
      </p>

      <div className="relative mt-10 rounded-[28px] bg-[#1a1a1d] p-5 sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/qr/beta-signup-qr-share.png"
          alt="QR code linking to the mcgilltickets.party beta signup"
          className="h-[220px] w-[220px] sm:h-[280px] sm:w-[280px]"
        />
      </div>

      <p className="relative mt-6 text-[14px] font-semibold text-[#ffe500]">mcgilltickets.party</p>
      <p className="relative mt-3 max-w-xs text-[12px] leading-relaxed text-muted">
        Share this screen. For flyers, print{" "}
        <a className="text-ink underline decoration-white/20 underline-offset-2" href="/qr/beta-signup-qr-print.png">
          the plain QR
        </a>
        .
      </p>
      {/* Keep the tracked URL in markup for anyone inspecting / regenerating assets. */}
      <p className="sr-only">{ACQUISITION_LANDING.qr_share}</p>
    </main>
  );
}
