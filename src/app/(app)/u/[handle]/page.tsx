import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSessionUser } from "@/domains/users/session";
import {
  followCounts,
  getProfileByHandle,
  isFollowing,
  listUpcomingAttendance,
} from "@/domains/social/data";
import { longDate } from "@/lib/format";
import { ArrowLeft } from "@/components/icons";
import { FollowButton } from "@/components/follow-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `@${handle} · Passe` };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const viewer = await requireSessionUser(`/u/${handle}`);

  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();

  const isSelf = profile.id === viewer.id;
  const [counts, viewerFollows, going] = await Promise.all([
    followCounts(profile.id),
    isSelf ? Promise.resolve(false) : isFollowing(viewer.id, profile.id),
    listUpcomingAttendance(profile.id),
  ]);

  return (
    <main className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <Link href="/profile" aria-label="Back" className="pill flex h-11 w-11 items-center justify-center">
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full border border-hairline bg-card text-[20px] font-bold">
            {profile.displayName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-bold uppercase tracking-tight">
              {profile.displayName}
            </h1>
            <p className="truncate text-[14px] text-muted">@{profile.handle}</p>
          </div>
        </div>

        {!isSelf && <FollowButton followeeId={profile.id} handle={profile.handle} following={viewerFollows} />}
      </div>

      <div className="mt-5 flex gap-5 text-[13.5px] text-muted">
        <span>
          <span className="font-bold text-ink">{counts.following}</span> following
        </span>
        <span>
          <span className="font-bold text-ink">{counts.followers}</span> followers
        </span>
      </div>

      <section className="mt-9">
        <h2 className="section-header">
          {isSelf ? "You're going to" : `${profile.displayName.split(" ")[0]} is going to`}
        </h2>

        {going.length === 0 ? (
          <p className="surface mt-3 rounded-2xl px-5 py-8 text-center text-[14px] text-muted">
            {isSelf
              ? "Confirm you're going on an event page and it'll show up here."
              : viewerFollows
                ? "Nothing upcoming yet."
                : "Follow to see what they're going to."}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {going.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="surface flex items-center gap-3 rounded-2xl p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.flyer_url ?? "/flyers/mtelus.svg"}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-bold">{event.name}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted">
                    {event.venue} · {longDate(event.starts_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
