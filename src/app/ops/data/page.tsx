import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { DataHealthBoard } from "@/components/beta-ops/data-health-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import {
  listEventDemand,
  listEventSalesSummary,
  listIntegrityFindings,
  listIntegrityRuns,
  listRecentLifecycleEvents,
} from "@/domains/data-capture/service";
import { summarizeFindings } from "@/domains/data-capture/shared";

export const metadata: Metadata = {
  title: "Data · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The data-capture console (DATA_CAPTURE.md): what's broken, what sold, and
 * what happened — read straight off the integrity and analytics views.
 */
export default async function OpsDataPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  // Every read here targets a view that only exists once the data-capture
  // migrations are pushed. Until then the tab should say so, not 500 — same
  // posture as `listOpsTransactions().catch(() => null)` in the ops chrome.
  const [findings, runs, sales, demand, timeline] = await Promise.all([
    listIntegrityFindings().catch(() => null),
    listIntegrityRuns(5).catch(() => []),
    listEventSalesSummary().catch(() => []),
    listEventDemand().catch(() => []),
    listRecentLifecycleEvents(60).catch(() => []),
  ]);

  if (findings === null) {
    return (
      <OpsChrome active="data">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Data</h1>
        </div>
        <p className="rounded-lg bg-zinc-900/60 px-3.5 py-4 text-sm text-zinc-400">
          The data-capture views aren&rsquo;t on this database yet. Run{" "}
          <code className="text-zinc-300">supabase db push</code> to apply the{" "}
          <code className="text-zinc-300">20260923*</code> migrations, then reload.
        </p>
      </OpsChrome>
    );
  }

  return (
    <OpsChrome active="data">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Data</h1>
        <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
          Integrity checks, sales and demand per event, and the raw lifecycle
          history. Everything here is a live query — nothing is cached.
        </p>
      </div>
      <DataHealthBoard
        summary={summarizeFindings(findings)}
        findings={findings}
        runs={runs}
        sales={sales}
        demand={demand}
        timeline={timeline}
      />
    </OpsChrome>
  );
}
