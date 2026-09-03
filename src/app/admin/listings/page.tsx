import { listAllListings } from "@/domains/admin/service";
import { formatCad } from "@/lib/compliance/pricing";
import { ListingModerationCard } from "./listing-moderation-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Listings · Passe" };

const STATUS_LABEL: Record<string, string> = {
  active: "Live",
  reserved: "Reserved",
  sold: "Sold",
  cancelled: "Removed",
  expired: "Expired",
};

export default async function AdminListingsPage() {
  const listings = await listAllListings();

  return (
    <div>
      <h1 className="text-[20px] font-bold">Listing moderation</h1>
      <p className="mt-1 text-[13.5px] text-muted">
        Listings go live immediately on posting — this is reactive moderation, not a pre-approval
        gate. Flag or remove anything that looks wrong.
      </p>

      {listings.length === 0 ? (
        <p className="surface mt-6 rounded-2xl p-6 text-center text-[14px] text-muted">
          No listings yet.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {listings.map((listing) => (
            <ListingModerationCard
              key={listing.id}
              listing={{
                id: listing.id,
                price: Number(listing.price),
                status: listing.status,
                flaggedAt: listing.flagged_at,
                flaggedReason: listing.flagged_reason,
                removedAt: listing.removed_at,
                createdAt: listing.created_at,
              }}
              statusLabel={STATUS_LABEL[listing.status] ?? listing.status}
              formattedPrice={formatCad(Number(listing.price))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
