import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventDetailById } from "@/domains/events/data";
import { listActiveListingsForEvent } from "@/domains/listings/data";
import { isOnWaitlist } from "@/domains/waitlist/service";
import { requireSessionUser } from "@/domains/users/session";
import { logEvent } from "@/lib/analytics/log";
import { formatCad, longDate } from "@/lib/format";
import { SERVICE_FEE_CAD, SERVICE_FEE_LABEL } from "@/lib/compliance/fees";
import { DisclosurePanel } from "@/components/disclosure-panel";
import { TagPills } from "@/components/tag-pills";
import { ArrowLeft } from "@/components/icons";
import { CheckoutPanel } from "@/components/checkout-panel";
import { stripeConfigured, stripePublishableKey } from "@/lib/env";
import { posterTransitionName } from "@/components/event-cards";
import { TransitionLink } from "@/components/transition-link";
import { EventKeyInfo } from "@/components/event-key-info";
import { EventLineup } from "@/components/event-lineup";
import { EventOrganizer } from "@/components/event-organizer";
import { LocationTrigger } from "@/components/location-sheet";
import { ShareButton } from "@/components/share-button";
import { WaitlistHeart } from "@/components/waitlist-heart";
import { AttendanceToggle } from "@/components/attendance-toggle";
import { isAttending, listFriendsAttendingEvent } from "@/domains/social/data";

export const dynamic = "force-dynamic";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string; listing?: string }>;
}) {
  const { id } = await params;
  const { ref, listing: sharedListingId } = await searchParams;

  // A shared listing link (CLAUDE.md § Phase 3 done-when) has to survive a
  // signed-out visitor being bounced through /login and land back here,
  // params and all — see requireSessionUser's nextPath.
  const nextPath = `/events/${id}${sharedListingId ? `?listing=${sharedListingId}${ref ? `&ref=${ref}` : ""}` : ref ? `?ref=${ref}` : ""}`;
  const user = await requireSessionUser(nextPath);
  const event = await getEventDetailById(id);
  if (!event) notFound();

  const [listings, onWaitlist, going, friendsGoing] = await Promise.all([
    listActiveListingsForEvent(event.id),
    isOnWaitlist(user.id, event.id),
    isAttending(user.id, event.id),
    listFriendsAttendingEvent(user.id, event.id),
  ]);

  await logEvent({
    type: "event_page_view",
    userId: user.id,
    eventRefId: event.id,
    metadata: { referrer_source: ref === "share" ? "shared_link" : "in_app" },
  });

  if (ref === "share") {
    await logEvent({
      type: "share_link_opened",
      userId: user.id,
      eventRefId: event.id,
      listingRefId: sharedListingId ?? null,
    });
  }

  const faceValue = Number(event.original_price);
  const cheapestPrice =
    listings.length > 0 ? Math.min(...listings.map((l) => Number(l.price))) : null;

  return (
    <main>
      <div className="relative">
        <div className="aspect-[4/5] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.flyer_url ?? "/flyers/mtelus.svg"}
            alt={`Flyer for ${event.name}`}
            className="h-full w-full object-cover"
            style={{ viewTransitionName: posterTransitionName(event.id) }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-base via-base/20 to-transparent" />
        </div>

        <TransitionLink
          href="/upcoming"
          aria-label="Back"
          className="frosted absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full border border-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </TransitionLink>

        <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex items-center gap-2">
          <ShareButton eventId={event.id} eventName={event.name} />
          <WaitlistHeart eventId={event.id} joined={onWaitlist} variant="hero" />
        </div>
      </div>

      <div className="-mt-16 px-4">
        <h1 className="headline text-[30px] leading-tight">{event.name}</h1>

        <div className="mt-4 flex gap-3">
          {cheapestPrice !== null && (
            <a
              href="#tickets"
              className="flex flex-1 items-center justify-center rounded-full bg-ink px-5 py-3.5 text-[15px] font-bold text-base"
            >
              From {formatCad(cheapestPrice)}
            </a>
          )}
          <Link
            href={`/sell?event=${event.id}`}
            className={`flex items-center justify-center rounded-full border border-hairline px-5 py-3.5 text-[15px] font-bold ${
              cheapestPrice !== null ? "flex-1" : "w-full"
            }`}
          >
            Post a ticket to sell
          </Link>
        </div>

        <div className="mt-5">
          <EventKeyInfo
            startsAt={event.starts_at}
            venue={event.venue}
            city={event.city}
            hasResaleSupply={listings.length > 0}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <AttendanceToggle eventId={event.id} going={going} />
          {friendsGoing.length > 0 && (
            <p className="min-w-0 flex-1 truncate text-[13px] text-muted">
              {friendsGoing.length === 1
                ? `${friendsGoing[0].displayName} is going`
                : `${friendsGoing[0].displayName} + ${friendsGoing.length - 1} more going`}
            </p>
          )}
        </div>
      </div>

      <section id="tickets" className="mt-8 px-4">
        <h2 className="section-header">
          {listings.length > 0 ? "Tickets available" : "No tickets yet"}
        </h2>

        {listings.length > 0 ? (
          <div className="mt-3 space-y-3">
            {listings.map((listing) => (
              <div
                key={listing.id}
                id={`listing-${listing.id}`}
                className={`surface rounded-2xl p-4 ${
                  sharedListingId === listing.id ? "ring-2 ring-white/40" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[22px] font-bold tabular-nums">
                    {formatCad(Number(listing.price))}
                  </span>
                  <span className="flex items-center gap-3 text-[12.5px] text-muted">
                    {Number(listing.price) < faceValue ? "Below face value" : "At face value"}
                    <ShareButton eventId={event.id} eventName={event.name} listingId={listing.id} variant="text" />
                  </span>
                </div>

                <div className="mt-3">
                  <DisclosurePanel
                    originalPrice={faceValue}
                    ticketPrice={Number(listing.price)}
                    serviceFee={SERVICE_FEE_CAD}
                    serviceFeeLabel={SERVICE_FEE_LABEL}
                    eventName={event.name}
                    venue={event.venue}
                    startsAt={longDate(event.starts_at)}
                    verificationTier={event.verification_tier}
                  />
                </div>

                {listing.seller_id === user.id ? (
                  <p className="mt-3 text-center text-[13px] text-muted">This is your listing.</p>
                ) : (
                  <div className="mt-3">
                    <CheckoutPanel
                      listingId={listing.id}
                      price={Number(listing.price)}
                      paymentsEnabled={stripeConfigured()}
                      publishableKey={stripeConfigured() ? stripePublishableKey() : ""}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="surface mt-3 rounded-2xl px-5 py-8 text-center">
            <p className="text-[15px] font-medium">
              {event.is_sold_out ? "Sold out at the source" : "Nobody's reselling yet"}
            </p>
            <p className="mx-auto mt-2 max-w-xs text-[13.5px] leading-relaxed text-muted">
              Tap the heart above and we&apos;ll notify you the moment someone posts one.
            </p>
          </div>
        )}
      </section>

      <div className="mt-10 flex flex-col gap-10 px-4">
        <EventLineup lineup={event.lineup} />
        <EventOrganizer organizer={event.organizer} />

        {event.description && (
          <section>
            <h2 className="section-header">About</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{event.description}</p>
          </section>
        )}

        {event.tags.length > 0 && (
          <section>
            <h2 className="section-header">Tags</h2>
            <div className="mt-3">
              <TagPills tags={event.tags} max={8} />
            </div>
          </section>
        )}

        <LocationTrigger venue={event.venue} city={event.city} variant="card" />
      </div>

      <div className="h-10" />
    </main>
  );
}
