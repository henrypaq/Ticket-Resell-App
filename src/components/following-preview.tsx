import Link from "next/link";
import type { PublicProfile } from "@/domains/social/data";

/**
 * Bottom-of-page "Who I follow" — real data (Phase 3's Follow entity), via
 * listFollowing. Each row links to that person's public profile. The empty
 * case is handled by the caller (page.tsx hides the section entirely for an
 * account following no one, rather than rendering this with an empty array).
 */
export function FollowingPreview({ people }: { people: PublicProfile[] }) {
  if (people.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {people.map((person) => (
        <Link key={person.id} href={`/u/${person.handle}`} className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-[12px] font-bold text-ink">
            {person.displayName.slice(0, 2).toUpperCase()}
          </span>
          <p className="truncate text-[14px] text-ink">{person.displayName}</p>
        </Link>
      ))}
    </div>
  );
}
