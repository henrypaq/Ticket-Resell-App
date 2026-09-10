import Link from "next/link";
import { requireAdmin } from "@/domains/admin/guard";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/payments", label: "Payments" },
] as const;

/**
 * One console, three views — CLAUDE.md § Phase 1 admin console. requireAdmin()
 * runs here and again inside every action in admin/actions.ts; the route
 * rendering is never what grants the capability (SECURITY.md § authorization).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-header text-muted">Admin console</p>
          <p className="mt-1 text-[13px] text-muted">{admin.email}</p>
        </div>
        <Link href="/home" className="pill-quiet px-3.5 py-2 text-[13px] font-semibold">
          Exit
        </Link>
      </div>

      <nav className="no-scrollbar mt-6 flex gap-2 overflow-x-auto border-b border-hairline pb-3">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="pill-quiet shrink-0 px-4 py-2 text-[14px] font-medium text-ink"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}
