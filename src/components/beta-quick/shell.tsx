import { Starfield } from "@/components/beta-waitlist/starfield";

export function QuickGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60"
      style={{
        background:
          "radial-gradient(60% 60% at 50% 0%, rgba(110,225,255,0.16) 0%, rgba(110,225,255,0.06) 45%, transparent 75%)",
      }}
    />
  );
}

export function QuickShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
      <Starfield />
      <QuickGlow />
      {children}
    </div>
  );
}
