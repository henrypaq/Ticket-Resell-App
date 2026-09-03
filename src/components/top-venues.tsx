import type { PlaceholderVenue } from "@/lib/placeholder-content";

/**
 * Small venue profile cards, horizontal scroll. No Venue entity/image field
 * exists yet, so this uses the same initials-avatar fallback as
 * EventOrganizer rather than a real photo. Not a link anywhere — there's no
 * venue page to send someone to.
 */
export function TopVenues({ venues }: { venues: PlaceholderVenue[] }) {
  if (venues.length === 0) return null;

  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
      {venues.map((venue) => (
        <div
          key={venue.id}
          className="surface flex w-40 shrink-0 flex-col items-center gap-2.5 rounded-2xl p-4 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-card text-[15px] font-bold text-ink">
            {venue.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-ink">{venue.name}</p>
            <p className="mt-0.5 truncate text-[12px] text-muted">{venue.neighborhood}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
