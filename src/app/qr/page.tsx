import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the beta · mcgill.tickets",
  description: "Scan to join the mcgill.tickets beta waitlist.",
  robots: { index: false, follow: false },
};

/**
 * Full-screen branded QR display for tablets / TVs / print-to-PDF.
 * Assets also live in /public/qr/ for download and social posts.
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
        THE MCGILL.TICKETS
        <br />
        APP IS LAUNCHING SOON
      </h1>
      <p className="relative mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
        Scan to join the waitlist — beta members get priority access on launch.
      </p>

      <div className="relative mt-10 rounded-[28px] bg-[#1a1a1d] p-5 sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/qr/beta-signup-qr-branded.png"
          alt="QR code linking to the mcgill.tickets beta signup"
          className="h-[220px] w-[220px] sm:h-[280px] sm:w-[280px]"
        />
      </div>

      <p className="relative mt-6 text-[14px] font-semibold text-[#ffe500]">
        www.mcgilltickets.party
      </p>
      <p className="relative mt-8 text-[12px] text-muted">
        Download posters in <code className="text-ink/80">/qr/</code> — square, portrait, and story.
      </p>
    </main>
  );
}
