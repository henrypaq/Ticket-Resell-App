import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getOpsStats, listQuickLeads } from "@/domains/beta-ops/service";
import { ACQUISITION_CHANNEL_LABELS } from "@/lib/beta-acquisition";

export const metadata: Metadata = {
  title: "Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsOverviewPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  const [stats, recent] = await Promise.all([getOpsStats(), listQuickLeads()]);
  const newest = recent.slice(0, 5);

  return (
    <OpsChrome active="overview">
      <h1 className="headline text-[28px] leading-tight">Overview</h1>
      <p className="mt-2 text-[14px] text-muted">
        Classic questionnaire members + live /go buy &amp; sell queue.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Classic members" value={stats.classicMembers} href="/ops/members" />
        <Stat label="New waitlist" value={stats.buyNew} href="/ops/waitlist" />
        <Stat label="New sellers" value={stats.sellNew} href="/ops/sellers" />
        <Stat label="Open waitlist" value={stats.buyOpen} href="/ops/waitlist" />
        <Stat label="Open sellers" value={stats.sellOpen} href="/ops/sellers" />
        <Stat label="Completed" value={stats.done} href="/ops/waitlist" />
      </div>

      {stats.bySource.length > 0 && (
        <section className="mt-8">
          <h2 className="section-header text-[11px] text-muted">Members by source</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.bySource.map((row) => (
              <Link
                key={row.channel}
                href="/ops/members"
                className="rounded-full bg-white/8 px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-ink"
              >
                {row.channel in ACQUISITION_CHANNEL_LABELS
                  ? ACQUISITION_CHANNEL_LABELS[
                      row.channel as keyof typeof ACQUISITION_CHANNEL_LABELS
                    ]
                  : row.channel}{" "}
                · {row.count}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="section-header text-[11px] text-muted">Latest /go leads</h2>
          <Link
            href="/ops/waitlist"
            className="text-[13px] font-semibold text-muted underline decoration-dotted"
          >
            See all
          </Link>
        </div>
        {newest.length === 0 ? (
          <p className="mt-4 text-[14px] text-muted">No /go leads yet — share mcgilltickets.party/go.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {newest.map((lead) => (
              <li
                key={lead.id}
                className="flex items-center justify-between gap-3 rounded-[14px] bg-white/[0.05] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">
                    {lead.intent === "buy" ? "Need" : "Sell"} · {lead.eventName}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    ×{lead.quantity}
                    {lead.acquisitionChannel ? ` · ${lead.acquisitionChannel}` : ""}
                    {lead.contactInstagram
                      ? ` · @${lead.contactInstagram}`
                      : lead.contactPhone
                        ? ` · ${lead.contactPhone}`
                        : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {lead.status}
                </span>
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
      className="rounded-[16px] border border-hairline bg-white/[0.04] px-4 py-4 transition-colors hover:bg-white/[0.07]"
    >
      <p className="text-[28px] font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-[12.5px] text-muted">{label}</p>
    </Link>
  );
}
