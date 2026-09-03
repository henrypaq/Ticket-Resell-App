import { EventList, EventRow } from "@/components/event-cards";
import { getFeed } from "@/domains/events/service";
import { listAvailableTags } from "@/domains/events/data";
import { listWaitlistedEventIds } from "@/domains/waitlist/service";
import { requireSessionUser } from "@/domains/users/session";
import { logEvent } from "@/lib/analytics/log";
import { dayGroupLabel } from "@/lib/format";
import type { EventWithSupply } from "@/lib/types";
import { FilterChips } from "@/components/filter-chips";
import { EmptyState } from "@/components/empty-state";
import { SearchIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upcoming · Passe" };

const CITIES = ["Montreal"];

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; maxPrice?: string; date?: string; city?: string }>;
}) {
  const user = await requireSessionUser();
  const params = await searchParams;
  const filters = {
    tag: params.tag,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    date: params.date,
    city: params.city,
  };

  const [events, tags, waitlistedIds] = await Promise.all([
    getFeed(filters),
    listAvailableTags(),
    listWaitlistedEventIds(user.id),
  ]);
  const waitlisted = new Set(waitlistedIds);

  const filtered = Object.values(filters).some(Boolean);
  if (filtered && events.length === 0) {
    await logEvent({
      type: "search_no_results",
      userId: user.id,
      metadata: { surface: "upcoming_filters", filters },
    });
  }

  const groups = groupByDay(events);

  return (
    <main>
      <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <FilterChips tags={tags} cities={CITIES} />
      </div>

      {groups.length === 0 ? (
        <div className="mx-4 mt-8">
          <EmptyState
            icon={SearchIcon}
            title={filtered ? "Nothing matches those filters" : "Nothing on the calendar yet"}
          />
        </div>
      ) : (
        groups.map(([label, items]) => (
          <section key={label} className="mt-8">
            <h2 className="section-header px-4">{label}</h2>
            <div className="mt-3 px-4">
              <EventList>
                {items.map((event) => (
                  <EventRow key={event.id} event={event} onWaitlist={waitlisted.has(event.id)} />
                ))}
              </EventList>
            </div>
          </section>
        ))
      )}
    </main>
  );
}

function groupByDay(events: EventWithSupply[]): [string, EventWithSupply[]][] {
  const map = new Map<string, EventWithSupply[]>();
  for (const event of events) {
    const label = dayGroupLabel(event.starts_at);
    map.set(label, [...(map.get(label) ?? []), event]);
  }
  return [...map.entries()];
}
