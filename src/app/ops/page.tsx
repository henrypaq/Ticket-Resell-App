import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { TransactionsBoard } from "@/components/beta-ops/transactions-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getOpsStats } from "@/domains/beta-ops/service";
import { listOpsTransactions } from "@/domains/beta-ops/transactions";
import { reconcileExpiredOffers } from "@/domains/beta-matching/service";

export const metadata: Metadata = {
  title: "Transactions · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsTransactionsPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  // Sweep expiries when ops opens the hub (Hobby cron is daily-only).
  await reconcileExpiredOffers().catch(() => {});

  const [board, stats] = await Promise.all([listOpsTransactions(), getOpsStats()]);

  return (
    <OpsChrome active="transactions">
      <TransactionsBoard board={board} />

      <section className="mt-10 border-t border-zinc-800 pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Queue snapshot
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="New waitlist" value={stats.buyNew} href="/ops/events" />
          <Stat label="Open waitlist" value={stats.buyOpen} href="/ops/events" />
          <Stat label="New sellers" value={stats.sellNew} href="/ops/sellers" />
          <Stat label="Open sellers" value={stats.sellOpen} href="/ops/sellers" />
        </div>
        <p className="mt-3 text-[11px] text-zinc-600">
          Matching controls live under each seller on{" "}
          <Link href="/ops/sellers" className="text-zinc-400 underline underline-offset-2">
            Sellers
          </Link>
          .
        </p>
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
