import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { GlobalScanButton } from "@/components/barcode-scanner";

/**
 * Authenticated shell. Every route in this group re-checks the session on the
 * server itself (its own requireSessionUser() call) — the nav being visible
 * is never what grants access, and this layout deliberately does NOT also
 * gate here.
 *
 * It used to: a layout-level `await requireSessionUser()` with no arguments
 * ran ahead of every page's own call (Next.js renders a layout before its
 * child page), so a bare redirect to /login with no `next` param always won
 * the race — silently discarding whatever next-path a page had built for a
 * signed-out visitor (e.g. a shared listing link on /events/[id]). Two gates
 * checking the same thing isn't defense in depth if the outer one can't
 * carry the context the inner one needs.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg pb-32">
      <GlobalScanButton />
      {children}
      <BottomNav />
      <ServiceWorkerRegistrar />
    </div>
  );
}
