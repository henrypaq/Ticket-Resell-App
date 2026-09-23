import Link from "next/link";
import { redirect } from "next/navigation";
import { betaOpsLogoutAction } from "@/domains/beta-ops/actions";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getPastOpsData } from "@/domains/beta-ops/service";
import { countUnseenEventRequests } from "@/domains/beta-ops/event-requests";
import { listOpsTransactions } from "@/domains/beta-ops/transactions";
import { PastOpsModal } from "@/components/beta-ops/past-records-modal";
import { Button } from "@/components/ui/button";

const TABS = [
  { href: "/ops", label: "Transactions", key: "transactions" },
  { href: "/ops/requests", label: "Requests", key: "requests" },
  { href: "/ops/events", label: "Events", key: "events" },
  { href: "/ops/waitlist", label: "Waitlist", key: "waitlist" },
  { href: "/ops/sellers", label: "Sellers", key: "sellers" },
  { href: "/ops/offers", label: "Offers", key: "offers" },
  { href: "/ops/members", label: "Members", key: "members" },
  { href: "/ops/links", label: "Links", key: "links" },
  { href: "/ops/analytics", label: "Analytics", key: "analytics" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Shared chrome for authenticated ops pages. */
export async function OpsChrome({
  children,
  active,
}: {
  children: React.ReactNode;
  active: TabKey;
}) {
  const session = await getBetaOpsSession();
  if (!session) redirect("/ops/login");

  const [{ pastWaitlist, pastSellers }, unseenRequests, txBoard] = await Promise.all([
    getPastOpsData(),
    countUnseenEventRequests(),
    listOpsTransactions().catch(() => null),
  ]);

  const badges: Partial<Record<TabKey, number>> = {
    requests: unseenRequests,
    transactions: txBoard?.attentionCount ?? 0,
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight text-zinc-100">
              mcgill.tickets
            </span>
            <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
              ops
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">{session.email}</p>
        </div>
        <form action={betaOpsLogoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="rounded-md text-xs text-zinc-400 hover:text-zinc-100"
          >
            Sign out
          </Button>
        </form>
      </header>

      <nav className="mt-5 flex flex-wrap items-center gap-1 rounded-lg bg-zinc-900/80 p-1 text-zinc-400">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          const count = badges[tab.key] ?? 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  aria-label={`${count} new`}
                  className="absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-red-500 px-[3px] text-[9px] font-bold leading-none text-white shadow-sm"
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <main className="mt-6">{children}</main>

      <PastOpsModal pastWaitlist={pastWaitlist} pastSellers={pastSellers} />
    </div>
  );
}
