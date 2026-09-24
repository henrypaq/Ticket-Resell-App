import Link from "next/link";
import type { QuickWaitlistEntry } from "@/domains/beta-quick/shared";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import { AppFlowShell } from "./shell";

/**
 * Post-checkout screen for fixed-price events — queue position while ops
 * delivers, or ticket-transferred once ops finishes both confirmations.
 */
export function QueueScreen({ entry }: { entry: QuickWaitlistEntry }) {
  const ticketLabel =
    entry.quantity === 1 ? "1 ticket" : `${entry.quantity} tickets`;

  if (entry.ticketForwardedAt) {
    return (
      <AppFlowShell>
        <div className="flex flex-1 flex-col">
          <p className="font-ui text-[15px] font-semibold tracking-tight text-[#ffe500]">
            mcgill.tickets
          </p>
          <header className="mt-8">
            <p className="section-header">All set</p>
            <h1 className="headline mt-2 text-[28px] leading-[1.12] tracking-tight">
              Ticket transferred
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Your ticket for <span className="text-ink">{entry.eventName}</span> has been
              sent to the transfer email you gave us. Check that inbox (and spam) for the
              ticket.
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{ticketLabel}</p>
          </header>
          <Link href="/" className={`${BUTTON_CLASS} mt-10 w-full`}>
            Back to home
          </Link>
        </div>
      </AppFlowShell>
    );
  }

  const statusHint = entry.paymentRecordedAt
    ? "Payment confirmed — we’re transferring your ticket next."
    : "You’re in the queue. We’ll email you your tickets once you leave the queue.";

  return (
    <AppFlowShell>
      <div className="flex flex-1 flex-col">
        <p className="font-ui text-[15px] font-semibold tracking-tight text-[#ffe500]">
          mcgill.tickets
        </p>

        <div className="mt-8 flex items-start gap-4">
          <p
            className="font-ui shrink-0 text-[56px] font-bold leading-none tracking-tight tabular-nums text-[#ffe500] sm:text-[64px]"
            aria-label={`Position ${entry.position} in queue`}
          >
            {entry.position}
          </p>
          <div className="min-w-0 flex-1 pt-1.5">
            <p className="section-header">Your place in line</p>
            <h1 className="headline mt-1.5 text-[22px] leading-[1.15] tracking-tight sm:text-[24px]">
              {entry.eventName}
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{ticketLabel}</p>
          </div>
        </div>

        <p className="mt-8 text-[15px] leading-relaxed text-ink">{statusHint}</p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          Tickets for this event are delivered manually — keep an eye on the transfer email you
          gave us. You can check your position anytime from home.
        </p>

        <Link href="/" className={`${BUTTON_CLASS} mt-10 w-full`}>
          Back to home
        </Link>
      </div>
    </AppFlowShell>
  );
}

export function QueueUnavailable() {
  return (
    <AppFlowShell>
      <div className="flex flex-1 flex-col">
        <p className="font-ui text-[15px] font-semibold tracking-tight text-[#ffe500]">
          mcgill.tickets
        </p>
        <h1 className="headline mt-7 text-[28px] leading-[1.15] tracking-tight">
          Queue not found
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          We couldn&apos;t find that place in line on this device. Open home to see your waitlist.
        </p>
        <Link href="/" className={`${BUTTON_CLASS} mt-8 w-full`}>
          Back to home
        </Link>
      </div>
    </AppFlowShell>
  );
}
