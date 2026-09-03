import { listPendingEvents } from "@/domains/admin/service";
import { formatCad } from "@/lib/compliance/pricing";
import { EventReviewCard } from "./event-review-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Events · Passe" };

export default async function AdminEventsPage() {
  const events = await listPendingEvents();

  return (
    <div>
      <h1 className="text-[20px] font-bold">Event approval queue</h1>
      <p className="mt-1 text-[13.5px] text-muted">
        Every submitted or imported event sits here until approved. No path skips this — including
        events with a source link that parsed cleanly.
      </p>

      {events.length === 0 ? (
        <p className="surface mt-6 rounded-2xl p-6 text-center text-[14px] text-muted">
          Nothing waiting on review.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {events.map((event) => (
            <EventReviewCard
              key={event.id}
              event={{
                id: event.id,
                name: event.name,
                venue: event.venue,
                city: event.city,
                startsAt: event.starts_at,
                originalPrice: Number(event.original_price),
                priceSource: event.price_source,
                sourceUrl: event.source_url,
                sourcePlatform: event.source_platform,
                status: event.status,
              }}
              formattedPrice={formatCad(Number(event.original_price))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
