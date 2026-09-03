import type { CommunityHighlight } from "@/lib/placeholder-content";
import { PosterScrim } from "./event-cards";

/**
 * "Top Community" — smaller numbered cards, horizontal scroll. Rank is a
 * frosted badge in the same corner/shape as the hero's date badge; no share
 * count on the card itself (STYLE.md's tile rule keeps browse cards to
 * title-only — a visible number is exactly the kind of metadata that
 * belongs on a detail page once "most shared" is a real, computed stat).
 */
export function CommunityHighlights({ items }: { items: CommunityHighlight[] }) {
  if (items.length === 0) return null;

  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-2xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.flyerUrl ?? "/flyers/mtelus.svg"}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <PosterScrim />

          <div className="frosted absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full border border-white/15 px-1.5 text-[12px] font-bold text-ink">
            {item.rank}
          </div>

          <div className="absolute inset-x-0 bottom-0 p-2.5">
            <h3 className="headline truncate text-[13.5px] leading-tight text-ink">{item.title}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}
