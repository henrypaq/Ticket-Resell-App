import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getOpsFunnelReports } from "@/domains/beta-ops/funnel-data";
import { formatAcquisitionSource } from "@/lib/beta-acquisition";
import type { FunnelReport } from "@/domains/beta-ops/funnel";

export const metadata: Metadata = {
  title: "Analytics · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsAnalyticsPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  const { buy, sell, since } = await getOpsFunnelReports(14);

  return (
    <OpsChrome active="analytics">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-zinc-100">Funnel &amp; abandonment</h1>
        <p className="mt-1 text-xs text-zinc-400">
          Step views vs drop-off for the last 14 days (since{" "}
          {new Date(since).toLocaleDateString("en-CA", { timeZone: "America/Toronto" })}). Sourced
          from anonymous flow events — no phones or emails.
        </p>
      </div>

      <FunnelSection title="Buy flow" report={buy} />
      <FunnelSection title="Sell flow" report={sell} />
    </OpsChrome>
  );
}

function FunnelSection({ title, report }: { title: string; report: FunnelReport }) {
  const hasData = report.steps.some((s) => s.views > 0) || report.completed > 0;
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Completed submissions:{" "}
        <span className="tabular-nums text-zinc-300">{report.completed}</span>
      </p>
      {!hasData ? (
        <p className="mt-3 text-xs text-zinc-500">No funnel events yet — open /buy or /sell once.</p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-1.5">
            {report.steps.map((row) => (
              <li
                key={row.step}
                className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300"
              >
                <span className="font-medium capitalize">{row.step.replace(/_/g, " ")}</span>
                <span className="tabular-nums text-zinc-500">
                  {row.views} views
                  {row.dropOff > 0 ? ` · ${row.dropOff} drop` : ""}
                </span>
              </li>
            ))}
          </ul>
          {report.bySrc.length > 0 && (
            <div className="mt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                By source tag
              </h3>
              <ul className="mt-2 flex flex-col gap-1">
                {report.bySrc.slice(0, 10).map((row) => (
                  <li
                    key={row.src}
                    className="flex justify-between gap-3 rounded-md bg-zinc-950/50 px-2.5 py-1.5 text-[11px] text-zinc-400"
                  >
                    <span className="truncate">{formatAcquisitionSource(row.src)}</span>
                    <span className="shrink-0 tabular-nums">
                      {row.started} start · {row.completed} done
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
