"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runIntegrityChecksAction } from "@/domains/data-capture/actions";
import {
  describeFinding,
  type EventDemandRow,
  type EventSalesSummary,
  type FindingsSummary,
  type IntegrityFinding,
  type IntegrityRun,
  type LifecycleEntry,
  type Severity,
} from "@/domains/data-capture/shared";

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-red-500/10 text-red-300 ring-1 ring-red-500/30",
  warning: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30",
  info: "bg-zinc-800/70 text-zinc-300 ring-1 ring-zinc-700",
};

function money(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function when(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DataHealthBoard({
  summary,
  findings,
  runs,
  sales,
  demand,
  timeline,
}: {
  summary: FindingsSummary;
  findings: IntegrityFinding[];
  runs: IntegrityRun[];
  sales: EventSalesSummary[];
  demand: EventDemandRow[];
  timeline: LifecycleEntry[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const lastRun = runs[0] ?? null;

  const ordered = [...findings].sort((a, b) => {
    const rank = (s: Severity) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
    return rank(a.severity) - rank(b.severity) || a.checkName.localeCompare(b.checkName);
  });

  return (
    <div className="space-y-9">
      {/* ── Integrity ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Integrity · {summary.total} finding{summary.total === 1 ? "" : "s"}
          </h2>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await runIntegrityChecksAction();
                setMessage(result.error ?? result.message ?? null);
                router.refresh();
              })
            }
          >
            {pending ? "Running…" : "Run checks"}
          </Button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Pill severity="critical" label={`${summary.critical} critical`} />
          <Pill severity="warning" label={`${summary.warning} warning`} />
          <Pill severity="info" label={`${summary.info} info`} />
          {lastRun && (
            <span className="rounded-md bg-zinc-900/60 px-2 py-1 text-zinc-500">
              last snapshot {when(lastRun.startedAt)} · {lastRun.source}
            </span>
          )}
        </div>

        {message && <p className="mb-3 text-xs text-zinc-400">{message}</p>}

        {ordered.length === 0 ? (
          <p className="rounded-lg bg-zinc-900/60 px-3.5 py-4 text-sm text-zinc-400">
            Nothing flagged. Every check in <code className="text-zinc-500">integrity_findings</code>{" "}
            came back empty.
          </p>
        ) : (
          <ul className="space-y-2">
            {ordered.map((f, i) => {
              const guide = describeFinding(f.checkName);
              return (
                <li
                  key={`${f.checkName}-${f.subjectId ?? i}`}
                  className="rounded-lg bg-zinc-950/70 px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_STYLES[f.severity]}`}
                    >
                      {f.severity}
                    </span>
                    <span className="text-sm font-medium text-zinc-100">{guide.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{guide.action}</p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-600">
                    {f.checkName} · {f.subjectType ?? "record"} {f.subjectLabel ?? f.subjectId ?? "—"}
                    {f.eventSlug ? ` · ${f.eventSlug}` : ""}
                  </p>
                  {Object.keys(f.detail).length > 0 && (
                    <p className="mt-1 font-mono text-[10px] text-zinc-500">
                      {JSON.stringify(f.detail)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Sales ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Sales by event
        </h2>
        {sales.length === 0 ? (
          <p className="rounded-lg bg-zinc-900/60 px-3.5 py-4 text-sm text-zinc-500">
            No tickets listed yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {sales.map((s) => (
              <li key={s.eventSlug} className="rounded-lg bg-zinc-950/70 px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-zinc-100">{s.eventName}</span>
                  <span className="tabular-nums text-sm text-emerald-300">
                    {money(s.grossSalesCad)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {s.ticketsSold} ticket{s.ticketsSold === 1 ? "" : "s"} sold
                  {s.ticketsSoldFixedPrice > 0
                    ? ` (${s.ticketsSoldResale} resale · ${s.ticketsSoldFixedPrice} fixed price)`
                    : ""}
                  {s.sellThroughPct != null ? ` · ${s.sellThroughPct}% sell-through` : ""}
                  {s.avgSalePriceCad != null ? ` · avg ${money(s.avgSalePriceCad)}` : ""}
                  {s.medianMinutesToSell != null
                    ? ` · median ${Math.round(s.medianMinutesToSell)} min to sell`
                    : ""}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {s.unitsListed} listed · {s.unitsAvailable} available · {s.unitsOnHold} on hold ·{" "}
                  {s.awaitingDelivery} awaiting delivery · {s.awaitingPayout} awaiting payout
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Demand ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Demand vs supply
        </h2>
        {demand.length === 0 ? (
          <p className="rounded-lg bg-zinc-900/60 px-3.5 py-4 text-sm text-zinc-500">
            No waitlist seats yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {demand.map((d) => (
              <li key={d.eventSlug} className="rounded-lg bg-zinc-950/70 px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-zinc-100">{d.eventName}</span>
                  <span className="tabular-nums text-xs text-zinc-400">
                    {d.demandFilledPct != null ? `${d.demandFilledPct}% filled` : "—"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {d.ticketsWanted} wanted · {d.unitsSold} sold · {d.unmetDemand} unmet ·{" "}
                  {d.unitsAvailable} sitting available
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {d.buySeats} go seats · {d.classicSeats} member seats · {d.dormantSeats} dormant
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── History ────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Recent history · {timeline.length}
        </h2>
        {timeline.length === 0 ? (
          <p className="rounded-lg bg-zinc-900/60 px-3.5 py-4 text-sm text-zinc-500">
            Nothing recorded yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {timeline.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-zinc-950/60 px-3 py-2 text-xs"
              >
                <span className="tabular-nums text-zinc-500">{when(e.occurredAt)}</span>
                <span className="font-medium text-zinc-200">{e.eventName.replace(/_/g, " ")}</span>
                {e.eventSlug && <span className="text-zinc-500">{e.eventSlug}</span>}
                {e.previousState && e.newState && (
                  <span className="text-zinc-500">
                    {e.previousState} → {e.newState}
                  </span>
                )}
                {e.amount != null && (
                  <span className="tabular-nums text-emerald-300/80">{money(e.amount)}</span>
                )}
                <span className="text-zinc-600">
                  {e.actorLabel ? `${e.actorKind}: ${e.actorLabel}` : e.actorKind}
                  {e.source === "backfill" ? " · backfilled" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Pill({ severity, label }: { severity: Severity; label: string }) {
  return (
    <span className={`rounded-md px-2 py-1 font-medium ${SEVERITY_STYLES[severity]}`}>{label}</span>
  );
}
