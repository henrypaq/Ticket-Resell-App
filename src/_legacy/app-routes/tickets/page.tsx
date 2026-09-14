import Link from "next/link";
import { requireSessionUser } from "@/domains/users/session";
import { listListingsBySeller } from "@/domains/listings/data";
import { listPurchasedTicketsForBuyer } from "@/domains/payments/service";
import { formatCad, longDate } from "@/lib/format";
import { TransitionLink } from "@/components/transition-link";
import { PurchaseActions } from "./purchase-actions";
import type { ListingWithEventRow, PurchasedTicketRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tickets · Passe" };

type Bucket = "upcoming" | "pending" | "past";

const FILTERS: { key: Bucket; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "pending", label: "Pending" },
  { key: "past", label: "Past" },
];

const LISTING_STATUS_LABEL: Record<string, string> = {
  active: "Listed for sale",
  reserved: "Requested by a buyer",
  sold: "Sold",
  cancelled: "Cancelled",
  expired: "Expired",
};

type TicketEntry = {
  key: string;
  eventId: string;
  eventName: string;
  venue: string;
  startsAt: string;
  price: number;
  role: "selling" | "buying";
  bucket: Bucket;
  statusLabel: string;
  /**
   * A purchase still held and not yet confirmed/disputed — set for any
   * bucket, since a buyer can report a problem before the event too; only
   * "confirm entry" itself is gated on the event having passed
   * (eventHasPassed, checked separately in PurchaseActions).
   */
  heldTransaction?: { transactionId: string; eventHasPassed: boolean };
};

function fromListing(listing: ListingWithEventRow): TicketEntry {
  const eventPassed = new Date(listing.event.starts_at) < new Date();
  let bucket: Bucket;
  if (eventPassed || listing.status === "cancelled" || listing.status === "expired") {
    bucket = "past";
  } else if (listing.status === "reserved") {
    bucket = "pending";
  } else {
    bucket = "upcoming";
  }

  return {
    key: `listing-${listing.id}`,
    eventId: listing.event.id,
    eventName: listing.event.name,
    venue: listing.event.venue,
    startsAt: listing.event.starts_at,
    price: Number(listing.price),
    role: "selling",
    bucket,
    statusLabel: LISTING_STATUS_LABEL[listing.status] ?? listing.status,
  };
}

function fromPurchase(ticket: PurchasedTicketRow): TicketEntry {
  const eventPassed = new Date(ticket.event.starts_at) < new Date();
  let bucket: Bucket;
  let statusLabel: string;
  if (ticket.escrow_status === "disputed") {
    bucket = "pending";
    statusLabel = "Payment disputed";
  } else if (ticket.escrow_status === "refunded") {
    bucket = "past";
    statusLabel = "Refunded";
  } else if (eventPassed) {
    bucket = "past";
    statusLabel = ticket.buyer_confirmed_at ? "Confirming with the seller" : "Past event";
  } else {
    bucket = "upcoming";
    statusLabel = "Confirmed";
  }

  // A held, unconfirmed payment can act on it regardless of bucket — a buyer
  // can report a problem before the event, not only confirm entry after it
  // (CLAUDE.md § Phase 2 "buyer confirms entry, with a timeout/dispute path").
  const isHeldAndUnconfirmed = ticket.escrow_status === "held" && !ticket.buyer_confirmed_at;

  return {
    key: `purchase-${ticket.id}`,
    eventId: ticket.event.id,
    eventName: ticket.event.name,
    venue: ticket.event.venue,
    startsAt: ticket.event.starts_at,
    price: Number(ticket.amount),
    role: "buying",
    bucket,
    statusLabel,
    heldTransaction: isHeldAndUnconfirmed
      ? { transactionId: ticket.id, eventHasPassed: eventPassed }
      : undefined,
  };
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireSessionUser();
  const { filter } = await searchParams;
  const activeFilter: Bucket = filter === "pending" || filter === "past" ? filter : "upcoming";

  const [listings, purchases] = await Promise.all([
    listListingsBySeller(user.id),
    listPurchasedTicketsForBuyer(user.id),
  ]);

  const allEntries = [...listings.map(fromListing), ...purchases.map(fromPurchase)];
  const entries = allEntries.filter((entry) => entry.bucket === activeFilter);

  // The confirm-entry prompt (not the pre-event dispute affordance — that one
  // sits quietly on an otherwise-normal upcoming purchase) can land in a
  // bucket the user isn't currently viewing: a held payment for a past event
  // lives in "Past", which isn't the default tab. Badge only that case, so a
  // routine upcoming purchase never lights up as needing attention.
  const bucketsNeedingAttention = new Set(
    allEntries.filter((e) => e.heldTransaction?.eventHasPassed).map((e) => e.bucket),
  );

  entries.sort((a, b) =>
    activeFilter === "past"
      ? +new Date(b.startsAt) - +new Date(a.startsAt)
      : +new Date(a.startsAt) - +new Date(b.startsAt),
  );

  const EMPTY_COPY: Record<Bucket, string> = {
    upcoming: "Nothing upcoming — get a ticket or list one to sell.",
    pending: "Nothing pending right now.",
    past: "Nothing here yet.",
  };

  return (
    <main className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="headline text-[28px]">Tickets</h1>

      <div className="mt-5 flex gap-3">
        <Link
          href="/upcoming"
          className="flex flex-1 items-center justify-center rounded-full bg-ink px-5 py-3.5 text-[15px] font-bold text-base"
        >
          Get a ticket
        </Link>
        <Link
          href="/sell"
          className="flex flex-1 items-center justify-center rounded-full border border-hairline px-5 py-3.5 text-[15px] font-bold"
        >
          Upload a ticket
        </Link>
      </div>

      <div className="mt-6 flex gap-2">
        {FILTERS.map(({ key, label }) => (
          <TransitionLink
            key={key}
            href={`/tickets?filter=${key}`}
            aria-current={activeFilter === key ? "page" : undefined}
            className={`relative rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
              activeFilter === key ? "bg-ink text-base" : "pill-quiet text-muted"
            }`}
          >
            {label}
            {bucketsNeedingAttention.has(key) && key !== activeFilter && (
              <span
                aria-label="Needs your attention"
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-urgency"
              />
            )}
          </TransitionLink>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="surface mt-6 rounded-2xl px-5 py-8 text-center text-[14px] text-muted">
          {EMPTY_COPY[activeFilter]}
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {entries.map((entry) => (
            <div key={entry.key} className="surface rounded-2xl p-4">
              <Link href={`/events/${entry.eventId}`} className="block">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="headline truncate text-[16.5px]">{entry.eventName}</h3>
                  <span className="shrink-0 text-[17px] font-bold tabular-nums">
                    {formatCad(entry.price)}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] text-muted">
                  {entry.venue} · {longDate(entry.startsAt)}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="pill-quiet px-3 py-1 text-[12px] text-muted">
                    {entry.role === "selling" ? "Selling" : "Ticket"}
                  </span>
                  <span
                    className={`pill-quiet px-3 py-1 text-[12px] ${
                      entry.statusLabel === "Payment disputed" ? "text-urgency" : "text-muted"
                    }`}
                  >
                    {entry.statusLabel}
                  </span>
                </div>
              </Link>
              {entry.heldTransaction && (
                <PurchaseActions
                  transactionId={entry.heldTransaction.transactionId}
                  eventHasPassed={entry.heldTransaction.eventHasPassed}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
