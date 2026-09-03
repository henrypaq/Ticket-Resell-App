import { CalendarIcon, TicketIcon } from "./icons";
import { LocationTrigger } from "./location-sheet";
import { longDate, eventTime } from "@/lib/format";

/**
 * The clean, simple list directly under the title/CTAs — everything a buyer
 * needs to answer "is this worth my time" in one glance, before any of the
 * fuller content (lineup, organizer, description) further down. The
 * like/waitlist toggle lives on the banner as a heart, not here.
 */
export function EventKeyInfo({
  startsAt,
  venue,
  city,
  hasResaleSupply,
}: {
  startsAt: string;
  venue: string;
  city: string;
  hasResaleSupply: boolean;
}) {
  return (
    <div className="space-y-0.5 divide-y divide-hairline">
      <InfoRow icon={CalendarIcon}>
        {longDate(startsAt)} · {eventTime(startsAt)}
      </InfoRow>

      <LocationTrigger venue={venue} city={city} variant="row" />

      <InfoRow icon={TicketIcon}>
        {hasResaleSupply ? "Resale tickets available" : "No resale tickets yet"}
      </InfoRow>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  children,
}: {
  icon: (props: { className?: string }) => React.ReactElement;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <Icon className="h-[18px] w-[18px] shrink-0 text-muted" />
      <span className="text-[14.5px] text-ink">{children}</span>
    </div>
  );
}
