import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getOpsStats, listQuickLeads } from "@/domains/beta-ops/service";
import { ACQUISITION_CHANNEL_LABELS } from "@/lib/beta-acquisition";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsOverviewPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  const [stats, recent] = await Promise.all([getOpsStats(), listQuickLeads()]);
  const newest = recent.slice(0, 6);

  return (
    <OpsChrome active="overview">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Overview</h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-400">
          Classic questionnaire members and live /go buy &amp; sell queue.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Stat label="Classic members" value={stats.classicMembers} href="/ops/members" />
        <Stat label="New waitlist" value={stats.buyNew} href="/ops/waitlist" />
        <Stat label="New sellers" value={stats.sellNew} href="/ops/sellers" />
        <Stat label="Open waitlist" value={stats.buyOpen} href="/ops/waitlist" />
        <Stat label="Open sellers" value={stats.sellOpen} href="/ops/sellers" />
        <Stat label="Completed" value={stats.done} href="/ops/waitlist" />
      </div>

      {stats.bySource.length > 0 && (
        <section className="mt-7">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Members by source
          </h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {stats.bySource.map((row) => (
              <Link
                key={row.channel}
                href="/ops/members"
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <span>
                  {row.channel in ACQUISITION_CHANNEL_LABELS
                    ? ACQUISITION_CHANNEL_LABELS[
                        row.channel as keyof typeof ACQUISITION_CHANNEL_LABELS
                      ]
                    : row.channel}
                </span>
                <span className="text-zinc-500">· {row.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Latest /go leads
          </h2>
          <Link
            href="/ops/waitlist"
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            See all
          </Link>
        </div>
        {newest.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No /go leads yet — share mcgilltickets.party/go.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {newest.map((lead) => (
              <li
                key={lead.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900/60 px-3.5 py-2.5 transition-colors hover:bg-zinc-900/90"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-200">
                    {lead.intent === "buy" ? "Need" : "Sell"} · {lead.eventName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400 truncate">
                    ×{lead.quantity}
                    {lead.acquisitionChannel ? ` · ${lead.acquisitionChannel}` : ""}
                    {lead.contactInstagram
                      ? ` · @${lead.contactInstagram}`
                      : lead.contactPhone
                        ? ` · ${lead.contactPhone}`
                        : ""}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase font-semibold px-2 py-0.5">
                  {lead.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </OpsChrome>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-zinc-900/60 p-3.5 transition-colors hover:bg-zinc-900"
    >
      <p className="text-2xl font-bold tabular-nums text-zinc-100">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-400">{label}</p>
    </Link>
  );
}
