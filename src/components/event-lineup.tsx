import type { LineupEntry } from "@/lib/types";

/** Horizontal row of small circular avatars + names — STYLE.md's existing lineup/attendee pattern from the event-detail-mockup reference. No avatar images yet, so initials on a flat tile stand in. */
export function EventLineup({ lineup }: { lineup: LineupEntry[] }) {
  if (lineup.length === 0) return null;

  return (
    <section>
      <h2 className="section-header">Lineup</h2>
      <div className="no-scrollbar mt-3 flex gap-4 overflow-x-auto">
        {lineup.map((act, i) => (
          <div key={`${act.name}-${i}`} className="flex w-[72px] shrink-0 flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-card text-[15px] font-bold text-ink">
              {initials(act.name)}
            </span>
            <span className="mt-2 line-clamp-2 text-[12.5px] leading-tight text-ink">{act.name}</span>
            {act.role && <span className="mt-0.5 text-[11px] text-muted">{act.role}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
