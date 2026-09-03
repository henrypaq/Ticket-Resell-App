"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarIcon, CheckIcon, HeartIcon, SparkleIcon } from "./icons";

/**
 * Home's single-tap quick filters — smaller and shallower than FilterChips
 * (which stays scoped to /upcoming's full date/tag/price/city panel UI), but
 * real: every chip here changes the actual `EventFilters` query
 * (domains/events/data.ts), not a decorative label (STYLE.md § Filter chips).
 *
 * "Your venues" was dropped in favor of "Saved" — there's no venue/follow
 * entity yet (Phase 3), and a chip that can't actually filter anything is
 * exactly what STYLE.md rules out.
 */
export function HomeQuickFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const range = params.get("range") ?? "";
  const saved = params.get("saved") === "1";

  function toggleRange(value: "tonight" | "week") {
    const next = new URLSearchParams(params.toString());
    if (range === value) next.delete("range");
    else next.set("range", value);
    router.push(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  }

  function toggleSaved() {
    const next = new URLSearchParams(params.toString());
    if (saved) next.delete("saved");
    else next.set("saved", "1");
    router.push(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  }

  const chip = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-[15px] transition-colors ${
      active ? "pill font-medium text-ink" : "pill-quiet text-muted"
    }`;

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      <button
        type="button"
        onClick={() => toggleRange("tonight")}
        aria-pressed={range === "tonight"}
        className={chip(range === "tonight")}
      >
        <SparkleIcon className="h-[18px] w-[18px]" />
        Tonight
        {range === "tonight" && <CheckIcon className="h-3.5 w-3.5" />}
      </button>

      <button
        type="button"
        onClick={() => toggleRange("week")}
        aria-pressed={range === "week"}
        className={chip(range === "week")}
      >
        <CalendarIcon className="h-[18px] w-[18px]" />
        This week
        {range === "week" && <CheckIcon className="h-3.5 w-3.5" />}
      </button>

      <button
        type="button"
        onClick={toggleSaved}
        aria-pressed={saved}
        className={chip(saved)}
      >
        <HeartIcon className="h-[18px] w-[18px]" filled={saved} />
        Saved
        {saved && <CheckIcon className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
