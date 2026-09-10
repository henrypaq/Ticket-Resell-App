"use client";

import { usePathname } from "next/navigation";
import { TransitionLink } from "./transition-link";
import { CalendarIcon, SearchIcon, SparkleIcon, TicketIcon } from "./icons";

/**
 * Floating pill nav — STYLE.md § floating bottom navigation.
 * Margin from the screen edges (not edge-to-edge), frosted dark. Active state
 * is a filled icon + brighter text, not a colour swap. Search stays a separate
 * circular button beside the pill: it's a primary action here, because people
 * usually arrive looking for one specific event.
 */
const DESTINATIONS = [
  { href: "/home", label: "For You", Icon: SparkleIcon },
  { href: "/upcoming", label: "Upcoming", Icon: CalendarIcon },
  { href: "/tickets", label: "Tickets", Icon: TicketIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2 px-4">
        <div className="frosted flex flex-1 items-center rounded-full border border-white/10 p-1.5">
          {DESTINATIONS.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <TransitionLink
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 rounded-full px-3 py-2 transition-colors ${
                  active ? "bg-white/10 text-ink" : "text-muted"
                }`}
              >
                <Icon className="h-[22px] w-[22px]" filled={active} />
                <span className={`text-[11px] ${active ? "font-semibold" : ""}`}>{label}</span>
              </TransitionLink>
            );
          })}
        </div>

        <TransitionLink
          href="/search"
          aria-label="Search"
          className={`frosted flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border border-white/10 transition-colors ${
            pathname.startsWith("/search") ? "text-ink" : "text-muted"
          }`}
        >
          <SearchIcon className="h-6 w-6" />
        </TransitionLink>
      </div>
    </nav>
  );
}
