import type { OrganizerRow } from "@/lib/types";

/**
 * Presentational only, deliberately. CLAUDE.md's organizer entity is
 * "eventually followable" — that's the Phase 3 social layer, not built yet.
 * No Follow button here: a control that renders but doesn't do anything is
 * worse than no control at all.
 */
export function EventOrganizer({ organizer }: { organizer: OrganizerRow | null }) {
  if (!organizer) return null;

  return (
    <section>
      <h2 className="section-header">Organizer</h2>
      <div className="mt-3 flex items-center gap-3.5">
        {organizer.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={organizer.avatar_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full border border-hairline object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-[15px] font-bold text-ink">
            {organizer.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-ink">{organizer.name}</p>
          {organizer.handle && <p className="truncate text-[13px] text-muted">@{organizer.handle}</p>}
        </div>
      </div>
      {organizer.bio && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{organizer.bio}</p>
      )}
    </section>
  );
}
