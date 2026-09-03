import Link from "next/link";
import { requireSessionUser } from "@/domains/users/session";
import { listWaitlistedEventIds } from "@/domains/waitlist/service";
import { getEventsByIds } from "@/domains/events/data";
import { withSupply } from "@/domains/events/service";
import { signOut } from "@/app/login/actions";
import { listFollowing, searchProfilesByHandle } from "@/domains/social/data";
import { EventList, EventRow } from "@/components/event-cards";
import { ArrowLeft, SearchIcon } from "@/components/icons";
import { FollowButton } from "@/components/follow-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile · Passe" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireSessionUser();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const [waitlistedIds, following, searchResults] = await Promise.all([
    listWaitlistedEventIds(user.id),
    listFollowing(user.id),
    query ? searchProfilesByHandle(query) : Promise.resolve([]),
  ]);
  const liked = await withSupply(await getEventsByIds(waitlistedIds));
  // Keyed by id, not handle — profiles.handle is nullable, and two null
  // handles collapsing to the same "" key would make an unrelated search
  // result read as already-followed.
  const followingIds = new Set(following.map((f) => f.id));

  return (
    <main className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <Link href="/" aria-label="Back" className="pill flex h-11 w-11 items-center justify-center">
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <div className="mt-5 flex items-center gap-4">
        <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full border border-hairline bg-card text-[20px] font-bold">
          {user.displayName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-bold uppercase tracking-tight">
            {user.displayName}
          </h1>
          <p className="truncate text-[14px] text-muted">@{user.handle}</p>
        </div>
      </div>

      <section className="mt-9">
        <h2 className="section-header">Friends</h2>

        <form action="/profile" className="mt-3 flex items-center gap-2">
          <div className="pill flex flex-1 items-center gap-2 px-4 py-2.5">
            <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Find a friend by handle"
              className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
            />
          </div>
          <button type="submit" className="rounded-full border border-hairline px-4 py-2.5 text-[13.5px] font-semibold">
            Search
          </button>
        </form>

        {query && (
          <div className="mt-3 space-y-2">
            {searchResults.filter((r) => r.id !== user.id).length === 0 ? (
              <p className="text-[13px] text-muted">No one with a handle matching &quot;{query}&quot;.</p>
            ) : (
              searchResults
                .filter((r) => r.id !== user.id)
                .map((r) => (
                  <div key={r.id} className="surface flex items-center justify-between gap-3 rounded-2xl p-3">
                    <Link href={`/u/${r.handle}`} className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">{r.displayName}</p>
                      <p className="truncate text-[12.5px] text-muted">@{r.handle}</p>
                    </Link>
                    <FollowButton followeeId={r.id} handle={r.handle} following={followingIds.has(r.id)} />
                  </div>
                ))
            )}
          </div>
        )}

        <h3 className="mt-6 text-[13px] font-medium text-muted">Following ({following.length})</h3>
        {following.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">Search above to follow someone.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {following.map((f) => (
              <Link key={f.id} href={`/u/${f.handle}`} className="pill-quiet px-3 py-1.5 text-[13px]">
                @{f.handle}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-9">
        <h2 className="section-header">Liked events</h2>
        {liked.length === 0 ? (
          <p className="surface mt-3 rounded-2xl px-5 py-8 text-center text-[14px] text-muted">
            Tap the heart on an event to save it here — we&apos;ll notify you when a ticket drops.
          </p>
        ) : (
          <div className="mt-3">
            <EventList>
              {liked.map((event) => (
                <EventRow key={event.id} event={event} onWaitlist />
              ))}
            </EventList>
          </div>
        )}
      </section>

      <form action={signOut} className="mt-10">
        <button
          type="submit"
          className="w-full rounded-full border border-hairline px-5 py-3.5 text-[14px] font-semibold text-muted"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
