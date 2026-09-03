import type { EventWithSupply } from "@/lib/types";
import { dayBadge, eventTime, formatCad, urgencyCountdown } from "@/lib/format";
import { WaitlistHeart } from "./waitlist-heart";
import { TransitionLink } from "./transition-link";
import { TagPills } from "./tag-pills";

/**
 * Poster art always carries its own text — a full-bleed image with the title
 * inside it, not a thumbnail with copy beside or beneath. Both the hero card
 * and the grid tile below share this shape; only proportions and type scale
 * differ. Everything that isn't the title or the date lives on the event page.
 */
/** Exported so other poster-shaped cards (community, showcase) share the exact same scrim. */
export function PosterScrim() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent"
    />
  );
}

function DateBadge({ iso }: { iso: string }) {
  const { weekday, day } = dayBadge(iso);
  return (
    <div className="frosted flex flex-col items-center rounded-xl border border-white/15 px-2.5 py-1.5 leading-none text-ink">
      <span className="text-[10px] font-semibold uppercase tracking-wide">{weekday}</span>
      <span className="mt-0.5 text-[15px] font-bold">{day}</span>
    </div>
  );
}

/** Shared between a grid/hero tile and the event page hero so the poster image morphs across the navigation instead of cutting. */
export function posterTransitionName(eventId: string): string {
  return `poster-${eventId}`;
}

/** Featured hero — the full-width poster in the "For you" carousel. */
export function FeaturedEventCard({ event }: { event: EventWithSupply }) {
  return (
    <TransitionLink
      href={`/events/${event.id}`}
      className="relative block aspect-[4/5] w-full overflow-hidden rounded-[26px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={event.flyer_url ?? "/flyers/mtelus.svg"}
        alt=""
        className="h-full w-full object-cover"
        style={{ viewTransitionName: posterTransitionName(event.id) }}
      />
      <PosterScrim />

      <div className="absolute left-4 top-4">
        <DateBadge iso={event.starts_at} />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="headline truncate text-[26px] leading-tight text-ink">{event.name}</h3>
      </div>
    </TransitionLink>
  );
}

/**
 * List row — the unit for every browsable list (Upcoming, For You, Search,
 * liked events). A small square thumbnail with the event's name, time,
 * price, and venue beside it, one row after another — not a poster grid, so
 * more events fit on screen at once (STYLE.md § list rows).
 */
export function EventRow({
  event,
  onWaitlist = false,
}: {
  event: EventWithSupply;
  onWaitlist?: boolean;
}) {
  const price = event.lowest_price ?? event.original_price;
  const countdown = urgencyCountdown(event.starts_at);

  return (
    <div className="flex items-center gap-3 py-3">
      <TransitionLink href={`/events/${event.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.flyer_url ?? "/flyers/mtelus.svg"}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            style={{ viewTransitionName: posterTransitionName(event.id) }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="headline truncate text-[15.5px] leading-tight text-ink">{event.name}</h3>
          <p className="mt-1 truncate text-[12.5px] text-muted">
            {countdown ? <span className="text-urgency">{countdown}</span> : eventTime(event.starts_at)}
            {" · "}
            {formatCad(price)} · {event.venue}
          </p>
          {event.tags.length > 0 && (
            <div className="mt-2">
              <TagPills tags={event.tags} max={2} />
            </div>
          )}
        </div>
      </TransitionLink>

      <WaitlistHeart eventId={event.id} joined={onWaitlist} />
    </div>
  );
}

/** Divided list wrapper shared by every page that lists EventRows. */
export function EventList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-hairline">{children}</div>;
}
