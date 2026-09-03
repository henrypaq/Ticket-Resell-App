import type { FriendActivityItem } from "@/lib/placeholder-content";

/**
 * "What your friends are into" — a brief single-column list, not a heavy
 * feed. No like/comment affordance: the Friend/Follow entities are Phase 3
 * and unbuilt, so any interactive control here would be exactly the kind of
 * control-that-doesn't-work the codebase avoids elsewhere (event-organizer.tsx).
 */
export function FriendActivity({ items }: { items: FriendActivityItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-[13px] font-bold text-ink">
            {item.name.slice(0, 2).toUpperCase()}
          </span>
          <p className="min-w-0 truncate text-[14px] text-ink">
            <span className="font-semibold">{item.name}</span>{" "}
            <span className="text-muted">{item.action}</span>{" "}
            <span className="font-semibold">{item.eventTitle}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
