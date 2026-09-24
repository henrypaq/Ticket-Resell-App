import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { TransactionsBoard } from "@/components/beta-ops/transactions-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
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

  const board = await listOpsTransactions();

  const fixedOpen = (board.fixedPriceTxns ?? []).filter((t) => t.status !== "done");
  const awaitingPayment =
    fixedOpen.filter((t) => t.status === "awaiting_payment").length +
    board.paymentsToVerify.length;
  const awaitingTicket =
    fixedOpen.filter((t) => t.status === "awaiting_ticket").length +
    board.ticketsToForward.length;
  const ticketsIn = board.ticketsToVerify.length;
  const payouts = board.payoutsToSend.length;
  const completed =
    board.recentlyCompleted.length +
    (board.fixedPriceTxns ?? []).filter((t) => t.status === "done").length;

  return (
    <OpsChrome active="transactions">
      <TransactionsBoard board={board} />

      <section className="mt-10 border-t border-zinc-800 pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Snapshot
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <Stat label="Awaiting payment" value={awaitingPayment} />
          <Stat label="Tickets in" value={ticketsIn} />
          <Stat label="Send ticket" value={awaitingTicket} />
          <Stat label="Payouts" value={payouts} />
          <Stat label="Completed" value={completed} />
        </div>
      </section>
    </OpsChrome>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-900/60 p-3.5">
      <p className="text-2xl font-bold tabular-nums text-zinc-100">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-400">{label}</p>
    </div>
  );
}
