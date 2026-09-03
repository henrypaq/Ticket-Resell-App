import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { SectionHeader } from "@/components/section-header";
import { EventList, EventRow, FeaturedEventCard } from "@/components/event-cards";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { HomeQuickFilters } from "@/components/home-quick-filters";
import { EventShowcaseCard } from "@/components/event-showcase-card";
import { CommunityHighlights } from "@/components/community-highlights";
import { TopVenues } from "@/components/top-venues";
import { FriendActivity } from "@/components/friend-activity";
import { OrganizerRecs } from "@/components/organizer-recs";
import { FollowingPreview } from "@/components/following-preview";
import {
  communityHighlights,
  topVenues,
  friendActivity,
  organizerRecs,
  followingPreview,
} from "@/lib/placeholder-content";
import { getFeed } from "@/domains/events/service";
import { countUnread } from "@/domains/notifications/service";
import { listWaitlistedEventIds } from "@/domains/waitlist/service";
import { requireSessionUser } from "@/domains/users/session";
import { logEvent } from "@/lib/analytics/log";
import { EmptyState } from "@/components/empty-state";
import { SearchIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ForYouPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: "tonight" | "week"; saved?: string }>;
}) {
  const user = await requireSessionUser();
  const params = await searchParams;

  const [feedEvents, unread, waitlistedIds] = await Promise.all([
    getFeed({ range: params.range }),
    countUnread(user.id),
    listWaitlistedEventIds(user.id),
  ]);
  const waitlisted = new Set(waitlistedIds);

  const savedOnly = params.saved === "1";
  const events = savedOnly ? feedEvents.filter((event) => waitlisted.has(event.id)) : feedEvents;

  const filtered = Boolean(params.range) || savedOnly;
  if (filtered && events.length === 0) {
    await logEvent({
      type: "search_no_results",
      userId: user.id,
      metadata: { surface: "home_quick_filters", filters: { range: params.range, saved: savedOnly } },
    });
  }

  // The showcase gets its own event — soonest with active supply, falling
  // back to just-soonest — and is excluded from the carousel/list below it
  // so the same event never appears twice on the page.
  const showcase = events.find((event) => event.active_listings > 0) ?? events[0];
  const browsable = showcase ? events.filter((event) => event.id !== showcase.id) : events;
  const featured = browsable.slice(0, 3);
  const rest = browsable.slice(3);

  return (
    <main>
      <AppHeader unread={unread} initials={user.displayName.slice(0, 2).toUpperCase()} />

      <div className="mt-5 px-4">
        <HomeQuickFilters />
      </div>

      <div className="mt-7">
        <SectionHeader title="This week in Montreal" action={{ href: "/upcoming", label: "ALL" }} />

        <div className="mt-4 px-4">
          {featured.length > 0 ? (
            <FeaturedCarousel>
              {featured.map((event) => (
                <FeaturedEventCard key={event.id} event={event} />
              ))}
            </FeaturedCarousel>
          ) : (
            <EmptyState icon={SearchIcon} title="It's quiet in your city for now" />
          )}
        </div>

        {rest.length > 0 && (
          <div className="mt-3 px-4">
            <EventList>
              {rest.map((event) => (
                <EventRow key={event.id} event={event} onWaitlist={waitlisted.has(event.id)} />
              ))}
            </EventList>
          </div>
        )}
      </div>

      <div className="mt-10">
        <SectionHeader title="Top community" subtitle="The most shared events right now" />
        <div className="mt-4 px-4">
          <CommunityHighlights items={communityHighlights} />
        </div>
      </div>

      {showcase && (
        <div className="mt-10 px-4">
          <EventShowcaseCard event={showcase} />
        </div>
      )}

      <div className="mt-10">
        <SectionHeader title="Top venues" />
        <div className="mt-4 px-4">
          <TopVenues venues={topVenues} />
        </div>
      </div>

      <div className="mt-10 px-4">
        <SectionHeader title="What your friends are into" />
        <div className="mt-4">
          <FriendActivity items={friendActivity} />
        </div>
      </div>

      <div className="mt-10">
        <SectionHeader title="For you to follow" subtitle="Organizers and artists we think you'll like" />
        <div className="mt-4 px-4">
          <OrganizerRecs items={organizerRecs} />
        </div>
      </div>

      <div className="mt-10 px-4">
        <SectionHeader title="Who I follow" />
        <div className="mt-4">
          <FollowingPreview people={followingPreview} />
        </div>
      </div>

      <div className="mt-10 px-4">
        <Link
          href="/sell"
          className="flex w-full items-center justify-center rounded-full bg-ink px-5 py-4 text-[15px] font-bold text-base"
        >
          Post a ticket you can&apos;t use
        </Link>
      </div>
    </main>
  );
}
