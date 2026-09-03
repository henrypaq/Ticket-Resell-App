import { EventList, EventRow } from "@/components/event-cards";
import { search } from "@/domains/events/service";
import { listWaitlistedEventIds } from "@/domains/waitlist/service";
import { requireSessionUser } from "@/domains/users/session";
import { logEvent } from "@/lib/analytics/log";
import { SearchField } from "@/components/search-field";
import { EmptyState } from "@/components/empty-state";
import { SearchIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search · Passe" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireSessionUser();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const [results, waitlistedIds] = await Promise.all([
    query ? search(query) : Promise.resolve([]),
    listWaitlistedEventIds(user.id),
  ]);
  const waitlisted = new Set(waitlistedIds);

  // One of the highest-value demand signals in DATA_CAPTURE.md: someone wanted
  // a ticket to something and the platform had nothing for them.
  if (query && results.length === 0) {
    await logEvent({
      type: "search_no_results",
      userId: user.id,
      metadata: { query, surface: "search" },
    });
  }

  return (
    <main className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="headline text-[28px]">Search</h1>

      <div className="mt-5">
        <SearchField defaultValue={query} />
      </div>

      {!query ? (
        <div className="mt-8">
          <EmptyState icon={SearchIcon} title="It's quiet in your city for now" />
        </div>
      ) : results.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={SearchIcon} title={`Nothing for "${query}" yet`} />
        </div>
      ) : (
        <div className="mt-8">
          <h2 className="section-header">
            {results.length} result{results.length === 1 ? "" : "s"}
          </h2>
          <div className="mt-3">
            <EventList>
              {results.map((event) => (
                <EventRow key={event.id} event={event} onWaitlist={waitlisted.has(event.id)} />
              ))}
            </EventList>
          </div>
        </div>
      )}
    </main>
  );
}
