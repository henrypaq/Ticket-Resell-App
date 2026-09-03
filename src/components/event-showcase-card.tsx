import type { EventWithSupply } from "@/lib/types";
import { dayBadge } from "@/lib/format";
import { PosterScrim, posterTransitionName } from "./event-cards";
import { TransitionLink } from "./transition-link";

/**
 * The single spotlighted event — wider/shorter than the carousel's hero
 * (aspect-[4/5]) so it reads as its own distinct unit rather than a repeat of
 * it. Same title-only-plus-date-badge convention as the hero (STYLE.md's
 * tile rule keeps venue/price/tags off browse surfaces; the date badge is
 * the one established exception, carried over from FeaturedEventCard).
 */
export function EventShowcaseCard({ event }: { event: EventWithSupply }) {
  const { weekday, day } = dayBadge(event.starts_at);

  return (
    <TransitionLink
      href={`/events/${event.id}`}
      className="relative block aspect-[4/3] w-full overflow-hidden rounded-[26px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={event.flyer_url ?? "/flyers/mtelus.svg"}
        alt=""
        className="h-full w-full object-cover"
        style={{ viewTransitionName: posterTransitionName(event.id) }}
      />
      <PosterScrim />

      <div className="absolute left-4 top-4 frosted flex flex-col items-center rounded-xl border border-white/15 px-2.5 py-1.5 leading-none text-ink">
        <span className="text-[10px] font-semibold uppercase tracking-wide">{weekday}</span>
        <span className="mt-0.5 text-[15px] font-bold">{day}</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="headline truncate text-[28px] leading-tight text-ink">{event.name}</h3>
      </div>
    </TransitionLink>
  );
}
