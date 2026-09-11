import Link from "next/link";
import { BUTTON_CLASS } from "@/components/beta-waitlist/field-styles";
import { QuickShell } from "@/components/beta-quick/shell";

export function GoDoneScreen({ intent }: { intent: "buy" | "sell" }) {
  const headline =
    intent === "buy" ? "You're on the waitlist" : "Ticket listing received";
  const sub =
    intent === "buy"
      ? "We'll message you when a ticket opens up."
      : "We'll review your ticket and reach out when there's a buyer.";

  return (
    <QuickShell>
      <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
      <h1 className="headline mt-6 text-[30px] leading-tight">{headline}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{sub}</p>

      <Link
        href="/go"
        className="mt-10 flex min-h-[52px] items-center justify-center rounded-[14px] border border-white/20 bg-white/[0.06] px-8 text-[15px] font-semibold text-ink"
      >
        Back to home
      </Link>

      <section className="mt-4 flex flex-col gap-4 rounded-[20px] border border-[#ffe500]/25 bg-[#ffe500]/08 px-5 py-5">
        <h2 className="headline text-[22px] uppercase leading-[1.15] tracking-tight text-ink sm:text-[24px]">
          Become a beta member
        </h2>
        <p className="text-[14px] leading-relaxed text-muted">
          Signing up as a beta member unlocks the full app: save a complete profile, see all
          upcoming events, get alerts when tickets drop, join waitlists first.
        </p>
        <Link href="/member" className={`${BUTTON_CLASS} w-full`}>
          Join as a beta member
        </Link>
      </section>
    </QuickShell>
  );
}
