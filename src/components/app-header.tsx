import { TransitionLink } from "./transition-link";
import { BellIcon, PinIcon } from "./icons";

export function AppHeader({ unread = 0, initials }: { unread?: number; initials: string }) {
  return (
    <header className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <span className="pill inline-flex items-center gap-1.5 px-4 py-2.5 text-[15px] font-medium">
        <PinIcon className="h-[18px] w-[18px]" />
        Montreal
      </span>

      <div className="flex items-center gap-2">
        <TransitionLink
          href="/notifications"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="pill relative flex h-[42px] w-[42px] items-center justify-center text-ink"
        >
          <BellIcon className="h-[21px] w-[21px]" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-urgency px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-base">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </TransitionLink>

        <TransitionLink
          href="/profile"
          aria-label="Your profile"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-hairline bg-card text-[14px] font-bold"
        >
          {initials}
        </TransitionLink>
      </div>
    </header>
  );
}
