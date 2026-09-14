import Link from "next/link";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import { AppFlowShell } from "./shell";

/**
 * Terminal screen for both flows. The old `/go/done` used its last section to
 * sell beta membership — everyone reaching this screen is already a member
 * now, so it points back at the things they can actually do next instead.
 */
export function DoneScreen({ intent }: { intent: "buy" | "sell" }) {
  const headline = intent === "buy" ? "You're on the waitlist" : "Ticket listing received";
  const sub =
    intent === "buy"
      ? "We'll message you when a ticket opens up."
      : "We'll review your ticket and reach out when there's a buyer.";

  return (
    <AppFlowShell>
      <div className="flex flex-1 flex-col">
        <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-6 text-[30px] leading-tight">{headline}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{sub}</p>

        <Link href="/" className={`${BUTTON_CLASS} mt-10 w-full`}>
          Back to home
        </Link>

        <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
          {intent === "buy"
            ? "Your spot in line is on your home page — tap it any time to change how many tickets you need or how we reach you."
            : "Your listing is on your home page — you can remove it from there until it sells."}
        </p>

        <section className="mt-auto flex flex-col gap-4 rounded-[20px] border border-white/12 bg-white/[0.04] px-5 py-5">
          <h2 className="headline text-[20px] uppercase leading-[1.15] tracking-tight text-ink">
            Make sure we can reach you
          </h2>
          <p className="text-[14px] leading-relaxed text-muted">
            Alerts go out fast when a match comes up. Check which ones reach you by email or text.
          </p>
          <Link
            href="/settings"
            className="flex min-h-[48px] items-center justify-center rounded-[14px] border border-white/20 bg-white/[0.06] px-8 text-[15px] font-semibold text-ink transition-colors hover:bg-white/[0.1]"
          >
            Communication settings
          </Link>
        </section>
      </div>
    </AppFlowShell>
  );
}
