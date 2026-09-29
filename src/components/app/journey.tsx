"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
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

/**
 * Three brand dots in a steady wave — the same motion whether or not a refresh
 * is in flight, so the page reads as continuously live rather than twitchy.
 * `active` only lifts the label while a refresh lands.
 */
export function LiveDots({ active, label = "Live" }: { active: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-[5px]" aria-hidden>
        {[0, 0.45, 0.9].map((delay) => (
          <span
            key={delay}
            className="live-dot h-1.5 w-1.5 rounded-full bg-brand"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </span>
      <span
        className={`font-ui text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-500 ${
          active ? "text-ink/80" : "text-muted"
        }`}
      >
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
  { edge: string; top: string; bottom: string; pill: string; cta: string; line: string }
> = {
  emerald: {
    edge: "rgba(52, 211, 153, 0.5)",
    top: "#11271d",
    bottom: "#0c1a14",
    pill: "text-emerald-300",
    cta: "text-emerald-300",
    line: "border-emerald-400/35",
  },
  brand: {
    edge: "rgba(251, 191, 36, 0.5)",
    top: "#261f0d",
    bottom: "#19150b",
    pill: "text-brand",
    cta: "text-brand",
    line: "border-brand/35",
  },
  sky: {
    edge: "rgba(56, 189, 248, 0.45)",
    top: "#0f2230",
    bottom: "#0b161e",
    pill: "text-sky-300",
    cta: "text-sky-300",
    line: "border-sky-400/35",
  },
  neutral: {
    edge: "rgba(255, 255, 255, 0.16)",
    top: "#1c1c1f",
    bottom: "#141416",
    pill: "text-ink/80",
    cta: "text-ink/80",
    line: "border-white/15",
  },
};

/** Card geometry — fixed so the ticket outline can be drawn as one exact path. */
const STUB_W = 200;
const STUB_H = 156;
/** Height of the call-to-action stub; the notches sit on its top edge. */
const STUB_CTA_H = 40;
const STUB_RADIUS = 14;
const NOTCH_R = 7;

/**
 * The ticket silhouette: a rounded rectangle with a half-circle bitten out of
 * each side at the tear line. `inset` shrinks it evenly so a 1px stroke can sit
 * fully inside the shape.
 */
function ticketPath(inset = 0): string {
  const w = STUB_W - inset;
  const h = STUB_H - inset;
  const o = inset;
  const r = STUB_RADIUS - inset;
  const n = NOTCH_R + inset;
  const ny = STUB_H - STUB_CTA_H;
  return [
    `M ${o + r} ${o}`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${o + r}`,
    `V ${ny - n}`,
    `A ${n} ${n} 0 0 0 ${w} ${ny + n}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${o + r}`,
    `A ${r} ${r} 0 0 1 ${o} ${h - r}`,
    `V ${ny + n}`,
    `A ${n} ${n} 0 0 0 ${o} ${ny - n}`,
    `V ${o + r}`,
    `A ${r} ${r} 0 0 1 ${o + r} ${o}`,
    "Z",
  ].join(" ");
}

const TICKET_FILL_PATH = ticketPath(0);
const TICKET_STROKE_PATH = ticketPath(0.5);

/**
 * A ticket drawn as a ticket: flyer strip with a status pill, the details,
 * a perforated tear line with real notches cut out of both sides, and a
 * call-to-action stub. The silhouette is one SVG path (fill + 1px stroke) and
 * the content is clipped to the same path, so corners and notches stay crisp
 * in every browser. Used for every buyer and seller stage on home so the
 * wallet reads as one set.
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
  const gradientId = `ticket-fill-${useId().replace(/:/g, "")}`;
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? `${title} — ${status}`}
      className="group relative block shrink-0 transition-[transform,filter] hover:brightness-110 active:scale-[0.99]"
      style={{ width: STUB_W, height: STUB_H }}
    >
      <svg
        aria-hidden
        className="absolute inset-0"
        width={STUB_W}
        height={STUB_H}
        viewBox={`0 0 ${STUB_W} ${STUB_H}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.top} />
            <stop offset="100%" stopColor={t.bottom} />
          </linearGradient>
        </defs>
        <path d={TICKET_FILL_PATH} fill={`url(#${gradientId})`} />
      </svg>

      <div
        className="relative flex h-full flex-col"
        style={{ clipPath: `path('${TICKET_FILL_PATH}')` }}
      >
        <div className="relative h-[56px] w-full shrink-0 overflow-hidden">
          {flyerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flyerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />
          ) : null}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `linear-gradient(180deg, transparent 20%, ${t.top} 100%)` }}
          />
          <span
            className={`font-ui absolute left-2.5 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] backdrop-blur-sm ${t.pill}`}
          >
            {status}
          </span>
        </div>

        <div className="min-h-0 flex-1 px-3.5 pt-1.5">
          <p className="headline truncate text-[14.5px] leading-tight text-ink">{title}</p>
          <p className="mt-1 truncate text-[11.5px] text-ink/55">{detail}</p>
        </div>

        <div
          className={`font-ui flex shrink-0 items-center justify-between border-t border-dashed text-[12.5px] font-semibold ${t.line} ${t.cta}`}
          style={{ height: STUB_CTA_H, marginLeft: NOTCH_R + 5, marginRight: NOTCH_R + 5 }}
        >
          {cta}
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0"
        width={STUB_W}
        height={STUB_H}
        viewBox={`0 0 ${STUB_W} ${STUB_H}`}
      >
        <path d={TICKET_STROKE_PATH} fill="none" stroke={t.edge} strokeWidth={1} />
      </svg>
    </Link>
  );
}
