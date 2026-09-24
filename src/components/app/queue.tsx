"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { QuickWaitlistEntry } from "@/domains/beta-quick/shared";
import { ArrowLeft } from "@/components/icons";

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
 * Standalone `/queue` page — full-bleed like the fixed-price event screen.
 */
export function QueueScreen({ entry }: { entry: QuickWaitlistEntry }) {
  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-base">
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-base text-ink">
        <FixedPriceQueueView entry={entry} />
      </div>
    </div>
  );
}

/**
 * Same predetermined queue UI, embedded from home as a full-screen overlay
 * (no app header — matches the event page).
 */
export function FixedPriceQueueEmbedded({
  entry,
  onBack,
}: {
  entry: QuickWaitlistEntry;
  onBack: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-base">
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-base text-ink">
        <FixedPriceQueueView entry={entry} onBack={onBack} />
      </div>
    </div>
  );
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
  const goHome = onBack ?? (() => {
    window.location.assign("/");
  });

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative isolate h-[min(32vh,240px)] w-full shrink-0 overflow-hidden">
          {entry.flyerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.flyerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-white/[0.06]" />
          )}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(11,11,12,0.35) 0%, rgba(11,11,12,0.15) 35%, rgba(11,11,12,0.88) 78%, #0b0b0c 100%)",
            }}
          />
          <div className="relative flex h-full flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={goHome}
              className="font-ui inline-flex items-center gap-1.5 self-start rounded-full bg-black/40 px-3 py-1.5 text-[13px] font-semibold text-ink backdrop-blur-md transition-colors hover:bg-black/55"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="mt-auto pb-4">
              <p className="section-header text-white/70">Your place in line</p>
              <h1 className="headline mt-1.5 text-[24px] leading-[1.1] tracking-tight text-white sm:text-[26px]">
                {entry.eventName}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center px-5 pt-6 text-center sm:px-6">
          <div className="relative inline-flex items-end justify-center">
            <p
              className="font-ui text-[88px] font-bold leading-none tracking-tight tabular-nums text-brand sm:text-[96px]"
              aria-label={`Position ${entry.position} in queue`}
            >
              #{entry.position}
            </p>
            <span
              className="mb-3 ml-2 flex items-end gap-1"
              aria-hidden
              title="Live updating"
            >
              <LiveDot delay="0ms" active={refreshing} />
              <LiveDot delay="150ms" active={refreshing} />
              <LiveDot delay="300ms" active={refreshing} />
            </span>
          </div>
          <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted">
            Live position
          </p>
          <p className="mt-2.5 text-[16px] text-muted">
            {entry.quantity === 1 ? "1 ticket" : `${entry.quantity} tickets`}
            {entry.paymentAmount != null ? (
              <>
                <span className="text-ink/25"> · </span>
                <span className="tabular-nums">${entry.paymentAmount.toFixed(2)}</span>
              </>
            ) : null}
          </p>

          <div className="mt-10 w-full max-w-md text-left">
            {atFront ? (
              <FrontOfQueuePanel entry={entry} />
            ) : (
              <WaitingPanel position={entry.position} />
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
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

function LiveDot({ delay, active }: { delay: string; active: boolean }) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full bg-brand ${
        active ? "animate-bounce" : "animate-pulse opacity-60"
      }`}
      style={{ animationDelay: delay }}
    />
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
    <div>
      <p className="text-[16px] leading-relaxed text-ink/90">
        You’re in the queue. {aheadLine}, but we’ll start the delivery window shortly and send
        your ticket to the email you gave us.
      </p>
      <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
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
      <div>
        <p className="section-header text-brand/90">You’re next</p>
        <p className="mt-3 text-[16px] leading-relaxed text-ink/90">
          You’re at the front of the line. As soon as we confirm your Interac, a 20-minute
          delivery window starts and your ticket is sent automatically to the email you gave us.
        </p>
        {entry.transferEmail && (
          <p className="mt-4 text-[14px] leading-relaxed text-muted">
            Transfer email:{" "}
            <span className="text-ink/85">{entry.transferEmail}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="section-header text-brand/90">You’re next</p>
      <p className="mt-3 text-[16px] leading-relaxed text-ink/90">
        {expired
          ? "We’re sending your ticket now. Keep this page open — it will update when the transfer goes out."
          : "Payment confirmed. Your ticket will be sent automatically within this window — stay on this page."}
      </p>

      <div className="mt-8 flex flex-col items-center py-2">
        <p
          className="font-ui text-[56px] font-bold tabular-nums tracking-tight text-ink sm:text-[64px]"
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
        <p className="mt-2 text-center text-[14px] leading-relaxed text-muted">
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
  const goHome = onBack ?? (() => {
    window.location.assign("/");
  });

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative isolate h-[min(28vh,200px)] w-full shrink-0 overflow-hidden">
          {entry.flyerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.flyerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-white/[0.06]" />
          )}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(11,11,12,0.35) 0%, rgba(11,11,12,0.2) 40%, rgba(11,11,12,0.9) 80%, #0b0b0c 100%)",
            }}
          />
          <div className="relative flex h-full flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={goHome}
              className="font-ui inline-flex items-center gap-1.5 self-start rounded-full bg-black/40 px-3 py-1.5 text-[13px] font-semibold text-ink backdrop-blur-md transition-colors hover:bg-black/55"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="mt-auto pb-4">
              <p className="headline text-[22px] leading-tight tracking-tight text-white">
                {entry.eventName}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-8 sm:px-6">
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
        </div>
      </div>

      <div className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
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
    <div className="fixed inset-0 z-[60] flex justify-center bg-base">
      <div className="relative flex h-full w-full max-w-lg flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
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
    </div>
  );
}

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
