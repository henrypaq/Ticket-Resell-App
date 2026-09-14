import Link from "next/link";
import { UserIcon } from "@/components/icons";

/**
 * The app's only chrome: wordmark left, account button right. There is no
 * bottom nav — everything that used to live there is either on the home page
 * itself or behind this account button (`/settings`).
 *
 * Sticky rather than fixed so it stays in the same max-w-lg column as the
 * page. The safe-area padding lives on the sticky element, not the scroll
 * container, or the header would tuck under the notch as soon as the page
 * scrolls. `z-30` clears the `-z-10`/`-z-20` backdrop layers (Glow,
 * Starfield) and the sell-flow's in-page sheets.
 */
export function AppHeader({
  initials,
  accountHref = "/settings",
}: {
  /** Member initials, or null when they're not signed in yet. */
  initials?: string | null;
  accountHref?: string;
}) {
  return (
    <header className="sticky top-0 z-30 bg-base/85 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link
          href="/"
          className="text-[17px] font-semibold tracking-tight text-[#ffe500] transition-opacity hover:opacity-85"
        >
          mcgill.tickets
        </Link>

        <Link
          href={accountHref}
          aria-label="Account and settings"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[13px] font-bold text-ink transition-colors hover:bg-white/[0.12]"
        >
          {initials ? initials : <UserIcon className="h-[19px] w-[19px]" />}
        </Link>
      </div>
    </header>
  );
}

/** First letter of the first two words of a name — "Jane Doe" → "JD". */
export function initialsFromName(name: string | null | undefined): string | null {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return null;
  const letters = parts.map((p) => p[0]!.toUpperCase()).join("");
  return /[A-Z]/.test(letters) ? letters : null;
}
