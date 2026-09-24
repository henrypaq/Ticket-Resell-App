import { Starfield } from "@/components/forms/starfield";
import { AppHeader } from "./header";

/**
 * The one shell every signed-in screen renders inside: starfield backdrop,
 * sticky header, single mobile-width column. Replaces the old `QuickShell`
 * (/go) and `BetaShell` (/member) chrome, which differed only in whether they
 * carried a tab bar.
 */
export function AppShell({
  children,
  initials,
}: {
  children: React.ReactNode;
  initials?: string | null;
}) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <Starfield />
      <AppHeader initials={initials} />
      <div className="relative flex min-h-0 flex-1 flex-col px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        {children}
      </div>
    </div>
  );
}

/**
 * Chrome-less variant for the step flows (buy / sell / join), which own their
 * own back button and shouldn't offer an escape hatch mid-form.
 */
export function AppFlowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
      <Starfield />
      {children}
    </div>
  );
}
