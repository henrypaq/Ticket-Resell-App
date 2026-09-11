import Link from "next/link";
import { BUTTON_CLASS } from "@/components/beta-waitlist/field-styles";
import { QuickShell } from "@/components/beta-quick/shell";
import { TrustNote } from "@/components/beta-quick/shared";
import { GO_TRUST } from "@/lib/beta-trust";

export function GoDoneScreen({ intent }: { intent: "buy" | "sell" }) {
  const headline =
    intent === "buy" ? "You're on the waitlist" : "Ticket listing received";
  const sub =
    intent === "buy"
      ? "We'll message you when a ticket opens up."
      : "We'll review your ticket and reach out when there's a buyer.";
  const trust = intent === "buy" ? GO_TRUST.buyDone : GO_TRUST.sellDone;

  return (
    <QuickShell>
      <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
      <h1 className="headline mt-6 text-[30px] leading-tight">{headline}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{sub}</p>

      <div className="mt-6">
        <TrustNote label={trust.label}>{trust.body}</TrustNote>
      </div>

      <section className="mt-10 rounded-[20px] border border-[#ffe500]/25 bg-[#ffe500]/08 px-5 py-6">
        <h2 className="text-[20px] font-semibold leading-snug text-ink">
          Become a beta member
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Unlock the full app: save a complete profile, get alerts when tickets drop,
          and manage waitlists across multiple events — not just this one.
        </p>
        <Link href="/member" className={`${BUTTON_CLASS} mt-5`}>
          Join as a beta member
        </Link>
      </section>

      <Link
        href="/go"
        className="mt-4 flex min-h-[52px] items-center justify-center rounded-[14px] border border-white/20 bg-white/[0.06] px-8 text-[15px] font-semibold text-ink"
      >
        Back to home
      </Link>
    </QuickShell>
  );
}
