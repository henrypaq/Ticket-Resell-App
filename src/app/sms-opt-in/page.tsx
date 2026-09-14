import type { Metadata } from "next";
import Link from "next/link";

/**
 * Public, screenshot-friendly copy of the beta signup SMS consent step.
 * Used as Twilio toll-free verification opt-in proof — not part of the
 * live signup flow (that remains the last step of the join flow on `/`).
 */
export const metadata: Metadata = {
  title: "SMS updates · mcgill.tickets",
  description:
    "Opt in to receive ticket availability and checkout updates by text from mcgill.tickets.",
  robots: { index: false, follow: false },
};

export default function SmsOptInPage() {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-10 sm:px-6">
      <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>

      <p className="mt-8 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
        Step 7 of 7
      </p>
      <h1 className="headline mt-2 text-[28px] leading-tight tracking-tight">Almost there.</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-muted">
        We&apos;ll email you when your spot opens up. Want text updates too, for things like ticket
        availability and checkout windows?
      </p>

      <label className="mt-6 flex cursor-default items-start gap-3 rounded-2xl border border-hairline bg-card px-5 py-4">
        <input
          type="checkbox"
          checked
          readOnly
          aria-checked="true"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#6ee1ff]"
        />
        <span className="text-[14px] leading-relaxed text-ink">
          Yes, text me with ticket availability and checkout updates
        </span>
      </label>

      <p className="mt-6 text-[12.5px] leading-relaxed text-muted">
        Message frequency varies. Reply STOP to opt out, HELP for help. Msg &amp; data rates may
        apply.
      </p>

      <Link
        href="/"
        className="mt-10 inline-block text-[13.5px] font-semibold text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
      >
        Join the waitlist
      </Link>
    </main>
  );
}
