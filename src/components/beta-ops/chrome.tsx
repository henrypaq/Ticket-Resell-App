import Link from "next/link";
import { redirect } from "next/navigation";
import { betaOpsLogoutAction } from "@/domains/beta-ops/actions";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getPastOpsData } from "@/domains/beta-ops/service";
import { PastOpsModal } from "@/components/beta-ops/past-records-modal";
import { Button } from "@/components/ui/button";

const TABS = [
  { href: "/ops", label: "Overview" },
  { href: "/ops/members", label: "Members" },
  { href: "/ops/waitlist", label: "Waitlist" },
  { href: "/ops/sellers", label: "Sellers" },
] as const;

/** Shared chrome for authenticated ops pages. */
export async function OpsChrome({
  children,
  active,
}: {
  children: React.ReactNode;
  active: "overview" | "members" | "waitlist" | "sellers";
}) {
  const session = await getBetaOpsSession();
  if (!session) redirect("/ops/login");

  const { pastWaitlist, pastSellers } = await getPastOpsData();

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
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

      <nav className="mt-5 inline-flex items-center rounded-lg bg-zinc-900/80 p-1 text-zinc-400 gap-1">
        {TABS.map((tab) => {
          const key = tab.href === "/ops" ? "overview" : tab.href.split("/").pop()!;
          const isActive = active === key;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <main className="mt-6">{children}</main>

      <PastOpsModal pastWaitlist={pastWaitlist} pastSellers={pastSellers} />
    </div>
  );
}
