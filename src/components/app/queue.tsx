"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { QuickWaitlistEntry } from "@/domains/beta-quick/shared";
import { ArrowLeft } from "@/components/icons";
import { AppFlowShell } from "./shell";

const QUEUE_WINDOW_MS = 20 * 60 * 1000;

/** Minimal home escape — deliberately not brand yellow so buyers stay put. */
const HOME_LINK_CLASS =
  "font-ui flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-white/[0.06] px-8 text-[14px] font-semibold tracking-tight text-ink/70 transition-colors hover:bg-white/[0.1] hover:text-ink";

/** Predetermined-price seats — Interac declared, ticket delivered by ops (not marketplace holds). */
export function isPredeterminedQueueEntry(entry: QuickWaitlistEntry): boolean {
  return (
    Boolean(entry.buyerDeclaredSentAt) ||
    Boolean(entry.paymentRecordedAt) ||
    Boolean(entry.ticketForwardedAt) ||
    entry.paymentAmount != null
  );
}

/**
 * Standalone `/queue` page — chrome-less shell after checkout.
 */
export function QueueScreen({ entry }: { entry: QuickWaitlistEntry }) {
  return (
    <AppFlowShell>
      <FixedPriceQueueView entry={entry} />
    </AppFlowShell>
  );
}

/**
 * Same predetermined queue UI, embedded in home (keeps the app header).
 */
export function FixedPriceQueueEmbedded({
  entry,
  onBack,
}: {
  entry: QuickWaitlistEntry;
  onBack: () => void;
}) {
  return <FixedPriceQueueView entry={entry} onBack={onBack} />;
}

function FixedPriceQueueView({
  entry,
  onBack,
}: {
  entry: QuickWaitlistEntry;
  onBack?: () => void;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Keep the seat live so ops “ticket transferred” flips this screen without a reload.
  useEffect(() => {
    if (entry.ticketForwardedAt) return;
    const id = window.setInterval(() => {
      setRefreshing(true);
      router.refresh();
      window.setTimeout(() => setRefreshing(false), 900);
    }, 8_000);
    return () => window.clearInterval(id);
  }, [entry.ticketForwardedAt, router]);

  if (entry.ticketForwardedAt) {
    return <TransferredBody entry={entry} onBack={onBack} />;
  }

  const atFront = entry.position <= 1;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="font-ui mb-4 inline-flex items-center gap-2 self-start text-[13.5px] font-semibold text-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <p className="font-ui mb-4 text-[13px] font-semibold tracking-[0.04em] text-ink/55">
          mcgill.tickets
        </p>
      )}

      {entry.flyerUrl ? (
        <div className="relative isolate h-[min(42vh,320px)] w-full shrink-0 overflow-hidden rounded-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.flyerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-16">
            <p className="section-header text-white/70">Your place in line</p>
            <h1 className="headline mt-1.5 text-[26px] leading-[1.1] tracking-tight text-white sm:text-[28px]">
              {entry.eventName}
            </h1>
          </div>
        </div>
      ) : (
        <header>
          <p className="section-header text-muted">Your place in line</p>
          <h1 className="headline mt-2 text-[26px] leading-[1.12] tracking-tight text-ink">
            {entry.eventName}
          </h1>
        </header>
      )}

      <div className="mt-8 flex flex-col items-center text-center">
        <div className="relative inline-flex items-center justify-center">
          <p
            className="font-ui text-[72px] font-bold leading-none tracking-tight tabular-nums text-brand sm:text-[84px]"
            aria-label={`Position ${entry.position} in queue`}
          >
            #{entry.position}
          </p>
          <span
            className={`absolute -right-7 top-2 flex h-5 w-5 items-center justify-center ${
              refreshing ? "opacity-100" : "opacity-40"
            }`}
            aria-hidden
          >
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
          </span>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              refreshing ? "animate-pulse bg-brand" : "bg-brand/50"
            }`}
          />
          Live position
        </p>
        <p className="mt-2 text-[14px] text-muted">
          {entry.quantity === 1 ? "1 ticket" : `${entry.quantity} tickets`}
          {entry.paymentAmount != null ? (
            <>
              <span className="text-ink/25"> · </span>
              <span className="tabular-nums">${entry.paymentAmount.toFixed(2)}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-8 flex-1">
        {atFront ? (
          <FrontOfQueuePanel entry={entry} />
        ) : (
          <WaitingPanel position={entry.position} />
        )}
      </div>

      <div className="mt-auto pt-10">
        {onBack ? (
          <button type="button" onClick={onBack} className={HOME_LINK_CLASS}>
            Home
          </button>
        ) : (
          <Link href="/" className={HOME_LINK_CLASS}>
            Home
          </Link>
        )}
      </div>
    </div>
  );
}

function WaitingPanel({ position }: { position: number }) {
  const ahead = Math.max(0, position - 1);
  const aheadLine =
    ahead === 1
      ? "There is 1 person ahead of you"
      : ahead === 2
        ? "There are a couple of people ahead of you"
        : `There are ${ahead} people ahead of you`;

  return (
    <div className="rounded-[20px] bg-white/[0.04] px-5 py-5">
      <p className="text-[15px] leading-relaxed text-ink/90">
        You’re in the queue. {aheadLine}, but we’ll start the delivery window shortly and send
        your ticket to the email you gave us.
      </p>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Stay on this page — your place (#{position}) updates here as people ahead of you leave
        the queue.
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
          delivery window starts and your ticket is sent automatically to the email you gave us.
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
          : "Payment confirmed. Your ticket will be sent automatically within this window — stay on this page."}
      </p>

      <div className="mt-6 flex flex-col items-center py-2">
        <p
          className="font-ui text-[48px] font-bold tabular-nums tracking-tight text-ink sm:text-[56px]"
          aria-live="polite"
          aria-label={
            expired ? "Delivery window ended" : `${formatCountdown(remaining)} remaining`
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
          Sending to <span className="text-ink/85">{entry.transferEmail}</span>
        </p>
      )}
    </div>
  );
}

function TransferredBody({
  entry,
  onBack,
}: {
  entry: QuickWaitlistEntry;
  onBack?: () => void;
}) {
  const email = entry.transferEmail;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="font-ui mb-4 inline-flex items-center gap-2 self-start text-[13.5px] font-semibold text-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <p className="font-ui mb-4 text-[13px] font-semibold tracking-[0.04em] text-ink/55">
          mcgill.tickets
        </p>
      )}

      {entry.flyerUrl && (
        <div className="relative isolate h-[min(28vh,200px)] w-full shrink-0 overflow-hidden rounded-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.flyerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
            <p className="headline text-[22px] leading-tight tracking-tight text-white">
              {entry.eventName}
            </p>
          </div>
        </div>
      )}

      <header className="mt-8">
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

      <div className="mt-auto pt-12">
        {onBack ? (
          <button type="button" onClick={onBack} className={HOME_LINK_CLASS}>
            Home
          </button>
        ) : (
          <Link href="/" className={HOME_LINK_CLASS}>
            Home
          </Link>
        )}
      </div>
    </div>
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
