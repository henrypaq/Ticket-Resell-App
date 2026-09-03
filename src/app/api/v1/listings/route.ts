import { z } from "zod";
import { createListing, createListingSchema } from "@/domains/listings/service";
import { listActiveListingsForEvent } from "@/domains/listings/data";
import { getSessionUser } from "@/domains/users/session";
import { fail, invalid, ok, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const eventId = new URL(request.url).searchParams.get("eventId");
  const parsed = z.string().uuid().safeParse(eventId);
  if (!parsed.success) return invalid({ eventId: "Must be a valid event id." });

  const listings = await listActiveListingsForEvent(parsed.data);
  return ok(
    listings.map((l) => ({
      id: l.id,
      eventId: l.event_id,
      price: Number(l.price),
      status: l.status,
      disclosure: l.disclosure_snapshot,
      createdAt: l.created_at,
    })),
  );
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid({ body: "Expected a JSON body." });
  }

  const parsed = createListingSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());

  const result = await createListing(user.id, parsed.data);
  if (!result.ok) {
    // Price-cap rejections are a client error, not a server fault.
    return fail(422, { code: "listing_rejected", message: result.error, details: { field: result.field } });
  }

  return ok({ id: result.listing.id, price: Number(result.listing.price), status: result.listing.status }, { status: 201 });
}
