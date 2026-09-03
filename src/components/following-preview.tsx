import type { FollowingPreviewPerson } from "@/lib/placeholder-content";

/**
 * Bottom-of-page "Who I follow" — small avatar+name column. No Follow entity
 * yet (Phase 3), so this is display-only; nothing here is clickable.
 */
export function FollowingPreview({ people }: { people: FollowingPreviewPerson[] }) {
  if (people.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {people.map((person) => (
        <div key={person.id} className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-[12px] font-bold text-ink">
            {person.name.slice(0, 2).toUpperCase()}
          </span>
          <p className="truncate text-[14px] text-ink">{person.name}</p>
        </div>
      ))}
    </div>
  );
}
