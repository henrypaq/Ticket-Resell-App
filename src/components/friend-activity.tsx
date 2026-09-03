import Link from "next/link";
import type { FollowingActivityItem } from "@/domains/social/data";

/**
 * "What your friends are into" — real data (Phase 3's Follow +
 * AttendanceConfirmation): recent "I'm going" confirmations from people the
 * viewer follows, via listFollowingActivity (RLS-scoped, not a client-side
 * filter). Each row links to the event. The empty case is handled by the
 * caller (page.tsx hides the whole section rather than rendering this with
 * an empty array), since "what your friends are into" doesn't make sense to
 * show at all with zero follows.
 */
export function FriendActivity({ items }: { items: FollowingActivityItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item) => (
        <Link key={item.id} href={`/events/${item.eventId}`} className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-[13px] font-bold text-ink">
            {item.personName.slice(0, 2).toUpperCase()}
          </span>
          <p className="min-w-0 truncate text-[14px] text-ink">
            <span className="font-semibold">{item.personName}</span>{" "}
            <span className="text-muted">is going to</span>{" "}
            <span className="font-semibold">{item.eventTitle}</span>
          </p>
        </Link>
      ))}
    </div>
  );
}
