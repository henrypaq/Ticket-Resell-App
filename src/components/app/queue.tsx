"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { QuickWaitlistEntry } from "@/domains/beta-quick/shared";
import { AppFlowShell } from "./shell";

const QUEUE_WINDOW_MS = 20 * 60 * 1000;

/** Minimal home escape — deliberately not brand yellow so buyers stay put. */
const HOME_LINK_CLASS =
  "font-ui flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-white/[0.06] px-8 text-[14px] font-semibold tracking-tight text-ink/70 transition-colors hover:bg-white/[0.1] hover:text-ink";

/**
 * Post-checkout waitlist for fixed-price events — position, top-of-queue
 * delivery window, then a clean transferred confirmation once ops finishes.
 */
export function QueueScreen({ entry }: { entry: QuickWaitlistEntry }) {
  const router = useRouter();

  // Keep the seat live so ops “ticket transferred” flips this screen without a reload.
  useEffect(() => {
    if (entry.ticketForwardedAt) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 8_000);
    return () => window.clearInterval(id);
  }, [entry.ticketForwardedAt, router]);

  if (entry.ticketForwardedAt) {
    return <TransferredScreen entry={entry} />;
  }

  const atFront = entry.position <= 1;

  return (
    <AppFlowShell>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <p className="font-ui text-[13px] font-semibold tracking-[0.04em] text-ink/55">
          mcgill.tickets
        </p>

        <header className="mt-10">
          <p className="section-header text-muted">Your place in line</p>
          <h1 className="headline mt-3 text-[42px] leading-[1.05] tracking-tight text-ink sm:text-[48px]">
            <span className="tabular-nums text-brand">#{entry.position}</span>
          </h1>
          <p className="mt-4 text-[17px] font-medium leading-snug tracking-tight text-ink">
            {entry.eventName}
          </p>
          <p className="mt-1.5 text-[14px] text-muted">
            {entry.quantity === 1 ? "1 ticket" : `${entry.quantity} tickets`}
            {entry.paymentAmount != null ? (
              <>
                <span className="text-ink/25"> · </span>
                <span className="tabular-nums">
                  ${entry.paymentAmount.toFixed(2)}
                </span>
              </>
            ) : null}
          </p>
        </header>

        <div className="mt-10 flex-1">
          {atFront ? (
            <FrontOfQueuePanel entry={entry} />
          ) : (
            <WaitingPanel position={entry.position} />
          )}
        </div>

        <div className="mt-auto pt-10">
          <Link href="/" className={HOME_LINK_CLASS}>
            Home
          </Link>
        </div>
      </div>
    </AppFlowShell>
  );
}

function WaitingPanel({ position }: { position: number }) {
  return (
    <div className="rounded-[20px] bg-white/[0.04] px-5 py-5">
      <p className="text-[15px] leading-relaxed text-ink/90">
        You’re in the queue. When you reach the front, we’ll start a short delivery window and
        send your ticket to the email you gave us.
      </p>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Stay on this page — your place (#{position}) updates here as people ahead of you leave
        the line.
      </p>
    </div>
  );
}

function FrontOfQueuePanel({ entry }: { entry: QuickWaitlistEntry }) {
  const paymentConfirmed = Boolean(entry.paymentRecordedAt);
  const deadlineMs = queueDeadlineMs(entry);
  const remaining = useCountdown(deadlineMs);
  const expired = remaining <= 0;

  if (!paymentConfirmed) {
    return (
      <div className="rounded-[20px] bg-white/[0.04] px-5 py-5">
        <p className="section-header text-brand/90">You’re next</p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/90">
          You’re at the front of the line. As soon as we confirm your Interac, a 20-minute
          delivery window starts and your ticket goes to the email you gave us.
        </p>
        {entry.transferEmail && (
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            Transfer email:{" "}
            <span className="text-ink/85">{entry.transferEmail}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[20px] bg-white/[0.04] px-5 py-5">
      <p className="section-header text-brand/90">You’re next</p>
      <p className="mt-3 text-[15px] leading-relaxed text-ink/90">
        {expired
          ? "We’re sending your ticket now. Keep this page open — it will update when the transfer goes out."
          : "Payment confirmed. Your ticket will be sent within this window — stay on this page."}
      </p>

      <div className="mt-6 flex flex-col items-center py-2">
        <p
          className="font-ui text-[48px] font-bold tabular-nums tracking-tight text-ink sm:text-[56px]"
          aria-live="polite"
          aria-label={
            expired
              ? "Delivery window ended"
              : `${formatCountdown(remaining)} remaining`
          }
        >
          {expired ? "—" : formatCountdown(remaining)}
        </p>
        <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
          {expired ? "Sending now" : "Minutes left"}
        </p>
      </div>

      {entry.transferEmail && (
        <p className="mt-2 text-center text-[13px] leading-relaxed text-muted">
          Sending to{" "}
          <span className="text-ink/85">{entry.transferEmail}</span>
        </p>
      )}
    </div>
  );
}

function TransferredScreen({ entry }: { entry: QuickWaitlistEntry }) {
  const email = entry.transferEmail;

  return (
    <AppFlowShell>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <p className="font-ui text-[13px] font-semibold tracking-[0.04em] text-ink/55">
          mcgill.tickets
        </p>

        <header className="mt-14">
          <p className="section-header text-brand">You’re all set</p>
          <h1 className="headline mt-3 text-[34px] leading-[1.1] tracking-tight text-ink sm:text-[38px]">
            Your ticket has been transferred
          </h1>
          <p className="mt-5 text-[15.5px] leading-relaxed text-muted">
            Check{" "}
            {email ? (
              <span className="font-medium text-ink">{email}</span>
            ) : (
              "the email we have on file"
            )}{" "}
            for your ticket
            {entry.transferName ? (
              <>
                {" "}
                under <span className="text-ink/90">{entry.transferName}</span>
              </>
            ) : null}
            . Look in spam if you don’t see it within a few minutes.
          </p>
        </header>

        <div className="mt-10 rounded-[20px] bg-white/[0.04] px-5 py-4">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted">
            Event
          </p>
          <p className="mt-1.5 text-[16px] font-medium tracking-tight text-ink">
            {entry.eventName}
          </p>
          <p className="mt-1 text-[13.5px] text-muted">
            {entry.quantity === 1 ? "1 ticket" : `${entry.quantity} tickets`}
          </p>
        </div>

        <div className="mt-auto pt-12">
          <Link href="/" className={HOME_LINK_CLASS}>
            Home
          </Link>
        </div>
      </div>
    </AppFlowShell>
  );
}

export function QueueUnavailable() {
  return (
    <AppFlowShell>
      <div className="flex flex-1 flex-col">
        <p className="font-ui text-[13px] font-semibold tracking-[0.04em] text-ink/55">
          mcgill.tickets
        </p>
        <h1 className="headline mt-10 text-[28px] leading-[1.15] tracking-tight text-ink">
          Queue not found
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          We couldn&apos;t find that place in line on this device. Open home to see your
          waitlist.
        </p>
        <Link href="/" className={`${HOME_LINK_CLASS} mt-10`}>
          Home
        </Link>
      </div>
    </AppFlowShell>
  );
}

/** 20-minute delivery window once payment is confirmed. */
function queueDeadlineMs(entry: QuickWaitlistEntry): number {
  const startIso = entry.paymentRecordedAt ?? entry.buyerDeclaredSentAt ?? entry.createdAt;
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return Date.now() + QUEUE_WINDOW_MS;
  return start + QUEUE_WINDOW_MS;
}

function useCountdown(deadlineMs: number): number {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadlineMs - Date.now()));

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, deadlineMs - Date.now()));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  return remaining;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
