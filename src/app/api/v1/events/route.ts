import { getFeed } from "@/domains/events/service";
import { getSessionUser } from "@/domains/users/session";
import { ok, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Versioned read surface over the same domain services the UI uses — the route
 * layer only parses and formats (ARCHITECTURE.md § layering).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const events = await getFeed();
  return ok(
    events.map((e) => ({
      id: e.id,
      name: e.name,
      venue: e.venue,
      city: e.city,
      startsAt: e.starts_at,
      originalPrice: Number(e.original_price),
      verificationTier: e.verification_tier,
      tags: e.tags,
      activeListings: e.active_listings,
      lowestPrice: e.lowest_price,
    })),
  );
}
