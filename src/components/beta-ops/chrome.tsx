import Link from "next/link";
import { redirect } from "next/navigation";
import { betaOpsLogoutAction } from "@/domains/beta-ops/actions";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";

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

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
          <p className="mt-1 text-[12.5px] text-muted">{session.email}</p>
        </div>
        <form action={betaOpsLogoutAction}>
          <button
            type="submit"
            className="rounded-full border border-white/15 px-3.5 py-2 text-[13px] font-semibold text-muted hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>

      <nav className="mt-6 flex gap-2 overflow-x-auto border-b border-hairline pb-3">
        {TABS.map((tab) => {
          const key = tab.href === "/ops" ? "overview" : tab.href.split("/").pop()!;
          const isActive = active === key;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-medium ${
                isActive ? "bg-[#ffe500] text-black" : "bg-white/8 text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}
