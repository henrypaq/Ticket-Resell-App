"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight } from "@/components/icons";

/**
 * Building blocks for the full-screen "journey" pages — the treatment the
 * fixed-price flow introduced (flyer hero, pinned CTA bar, copy rows, live
 * refresh), shared so the marketplace buy and sell journeys feel the same.
 */

/** Low-emphasis escape — deliberately not brand yellow so people stay put. */
export const QUIET_BUTTON_CLASS =
  "font-ui flex min-h-[48px] w-full items-center justify-center rounded-[14px] bg-white/[0.06] px-8 text-[14px] font-semibold tracking-tight text-ink/70 transition-colors hover:bg-white/[0.1] hover:text-ink disabled:opacity-50";

/** Outlined brand toggle, e.g. "I've sent it" before the real submit. */
export const CONFIRM_TOGGLE_CLASS =
  "font-ui flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border border-brand/40 bg-brand/10 px-6 text-[14px] font-semibold tracking-tight text-brand transition-colors hover:bg-brand/15";
export const CONFIRM_TOGGLE_ON_CLASS =
  "font-ui flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border border-brand bg-brand/20 px-6 text-[14px] font-semibold tracking-tight text-brand";

/** Full-bleed overlay column with a scrolling body and an optional pinned footer. */
export function JourneyScreen({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-base">
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-base text-ink">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-col gap-2 border-t border-hairline bg-base/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Flyer across the top, fading into the page, with a frosted back pill. */
export function FlyerHero({
  flyerUrl,
  backHref = "/",
  onBack,
  eyebrow,
  title,
  subtitle,
  size = "md",
}: {
  flyerUrl?: string | null;
  backHref?: string;
  onBack?: () => void;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const height =
    size === "lg"
      ? "h-[min(44vh,340px)]"
      : size === "sm"
        ? "h-[min(26vh,190px)]"
        : "h-[min(32vh,240px)]";
  const backClass =
    "font-ui inline-flex items-center gap-1.5 self-start rounded-full bg-black/40 px-3 py-1.5 text-[13px] font-semibold text-ink backdrop-blur-md transition-colors hover:bg-black/55";

  return (
    <div className={`relative isolate w-full shrink-0 overflow-hidden ${height}`}>
      {flyerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flyerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
      <div className="relative flex h-full flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        {onBack ? (
          <button type="button" onClick={onBack} className={backClass}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        ) : (
          <Link href={backHref} className={backClass}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        )}
        <div className="mt-auto pb-4">
          {eyebrow && <p className="section-header text-white/70">{eyebrow}</p>}
          <h1 className="headline mt-1.5 text-[24px] leading-[1.1] tracking-tight text-white sm:text-[26px]">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-[13px] text-white/60">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Where you are in the journey, without naming the steps — a row of segments
 * that fill as things move along. `current` is 1-based.
 */
export function JourneyProgress({
  current,
  total,
  tone = "brand",
}: {
  current: number;
  total: number;
  tone?: "brand" | "emerald";
}) {
  const fill = tone === "emerald" ? "bg-emerald-400" : "bg-brand";
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i < current ? fill : "bg-white/10"
          } ${i === current - 1 ? "animate-pulse" : ""}`}
        />
      ))}
    </div>
  );
}

/** Soft card for supporting detail inside a journey body. */
export function JourneyCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`rounded-2xl bg-white/[0.04] p-4 ${className}`}>{children}</div>;
}

/** Tap-to-copy field (Interac email, memo, custody address…). */
export function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="flex w-full items-center gap-3 rounded-[12px] bg-base px-3.5 py-3 text-left transition-opacity active:opacity-75"
      aria-label={`Copy ${label.toLowerCase()} ${value}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
        <p
          className={`mt-0.5 break-all text-[14px] font-semibold tracking-tight text-ink ${
            mono ? "font-mono text-[13px] font-medium" : ""
          }`}
        >
          {value}
        </p>
      </div>
      <span className="font-ui shrink-0 text-[12px] font-semibold text-muted">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Server refresh on an interval while `enabled`; returns true briefly on each tick. */
export function useLiveRefresh(enabled: boolean, intervalMs = 8_000): boolean {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      setRefreshing(true);
      router.refresh();
      window.setTimeout(() => setRefreshing(false), 900);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  return refreshing;
}

/** Three brand dots — pulse at rest, bounce while a refresh is in flight. */
export function LiveDots({ active, label = "Live" }: { active: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1" aria-hidden>
        {["0ms", "150ms", "300ms"].map((delay) => (
          <span
            key={delay}
            className={`h-1.5 w-1.5 rounded-full bg-brand ${
              active ? "animate-bounce" : "animate-pulse opacity-60"
            }`}
            style={{ animationDelay: delay }}
          />
        ))}
      </span>
      <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
    </span>
  );
}

export function useCountdown(deadlineMs: number | null): number {
  const [remaining, setRemaining] = useState(() =>
    deadlineMs == null ? 0 : Math.max(0, deadlineMs - Date.now()),
  );

  useEffect(() => {
    if (deadlineMs == null) return;
    const tick = () => setRemaining(Math.max(0, deadlineMs - Date.now()));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  return remaining;
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Big centered countdown used on hold / delivery windows. */
export function CountdownDisplay({
  remainingMs,
  caption,
  expiredCaption,
}: {
  remainingMs: number;
  caption: string;
  expiredCaption: string;
}) {
  const expired = remainingMs <= 0;
  return (
    <div className="flex flex-col items-center py-2">
      <p
        className="font-ui text-[56px] font-bold tabular-nums tracking-tight text-ink sm:text-[64px]"
        aria-live="polite"
        aria-label={expired ? expiredCaption : `${formatCountdown(remainingMs)} remaining`}
      >
        {expired ? "—" : formatCountdown(remainingMs)}
      </p>
      <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">
        {expired ? expiredCaption : caption}
      </p>
    </div>
  );
}

export type StubTone = "brand" | "emerald" | "neutral" | "sky";

const STUB_TONES: Record<
  StubTone,
  { card: string; pill: string; fade: string; cta: string; line: string; notch: string }
> = {
  brand: {
    card: "border-brand/30 bg-brand/[0.07] hover:bg-brand/[0.11]",
    pill: "text-brand",
    fade: "to-[#1a160b]",
    cta: "text-brand",
    line: "border-brand/30",
    notch: "border-brand/30",
  },
  emerald: {
    card: "border-emerald-500/25 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.12]",
    pill: "text-emerald-300",
    fade: "to-[#0e1a14]",
    cta: "text-emerald-300",
    line: "border-emerald-500/30",
    notch: "border-emerald-500/25",
  },
  sky: {
    card: "border-sky-400/25 bg-sky-400/[0.07] hover:bg-sky-400/[0.11]",
    pill: "text-sky-300",
    fade: "to-[#0c141a]",
    cta: "text-sky-300",
    line: "border-sky-400/30",
    notch: "border-sky-400/25",
  },
  neutral: {
    card: "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]",
    pill: "text-ink/80",
    fade: "to-[#141416]",
    cta: "text-ink/80",
    line: "border-white/15",
    notch: "border-white/10",
  },
};

/**
 * A ticket drawn as a ticket: flyer strip with a status pill, the details,
 * a perforated tear line, and a call-to-action stub. Used for every buyer and
 * seller stage on home so the wallet reads as one set.
 */
export function TicketStubCard({
  href,
  flyerUrl,
  status,
  title,
  detail,
  cta,
  tone,
  ariaLabel,
}: {
  href: string;
  flyerUrl?: string | null;
  status: string;
  title: string;
  detail: string;
  cta: string;
  tone: StubTone;
  ariaLabel?: string;
}) {
  const t = STUB_TONES[tone];
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? `${title} — ${status}`}
      className={`group relative flex w-[200px] flex-col overflow-hidden rounded-[14px] border transition-colors active:scale-[0.99] ${t.card}`}
    >
      <div className="relative h-[52px] w-full overflow-hidden">
        {flyerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flyerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        ) : (
          <div className="absolute inset-0 bg-white/[0.05]" />
        )}
        <div aria-hidden className={`absolute inset-0 bg-gradient-to-b from-transparent ${t.fade}`} />
        <span
          className={`font-ui absolute left-2.5 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] backdrop-blur-sm ${t.pill}`}
        >
          {status}
        </span>
      </div>

      <div className="px-3 pb-3 pt-2">
        <p className="headline truncate text-[14px] leading-tight text-ink">{title}</p>
        <p className="mt-1 truncate text-[11.5px] text-muted">{detail}</p>
      </div>

      {/* Tear line with side notches cut into the page background. */}
      <div aria-hidden className="relative h-0">
        <span className={`absolute -left-[7px] -top-[7px] h-[14px] w-[14px] rounded-full border bg-base ${t.notch}`} />
        <span className={`absolute -right-[7px] -top-[7px] h-[14px] w-[14px] rounded-full border bg-base ${t.notch}`} />
        <div className={`mx-3 border-t border-dashed ${t.line}`} />
      </div>

      <div className={`font-ui flex items-center justify-between px-3 py-2.5 text-[12.5px] font-semibold ${t.cta}`}>
        {cta}
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
