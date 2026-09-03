import type { OrganizerRec } from "@/lib/placeholder-content";

/**
 * "Personally curated" organizer/artist recommendations — same
 * avatar+name+handle language as EventOrganizer, but its own compact card for
 * a horizontal list rather than a single detail-page section. No follow
 * affordance: same reasoning as EventOrganizer (Phase 3 not built).
 */
export function OrganizerRecs({ items }: { items: OrganizerRec[] }) {
  if (items.length === 0) return null;

  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
      {items.map((organizer) => (
        <div key={organizer.id} className="surface w-64 shrink-0 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-base text-[14px] font-bold text-ink">
              {organizer.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-ink">{organizer.name}</p>
              {organizer.handle && (
                <p className="truncate text-[12px] text-muted">@{organizer.handle}</p>
              )}
            </div>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{organizer.blurb}</p>
        </div>
      ))}
    </div>
  );
}
