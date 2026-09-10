"use server";

import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/domains/users/session";
import { attachTicketEvidencePhoto, createListing, createListingSchema } from "./service";

export type ListingFormState = { error?: string; field?: string; evidenceWarning?: string };

/**
 * Thin action layer: parse, call a service, revalidate. Business rules live in
 * domains/listings/service.ts (ARCHITECTURE.md § layering).
 */
export async function createListingAction(
  _prev: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  const user = await requireSessionUser();

  const parsed = createListingSchema.safeParse({
    eventId: formData.get("eventId"),
    price: formData.get("price"),
    attestation: formData.get("attestation") === "on",
    ticketBarcode: formData.get("ticketBarcode") || undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0] ?? "") };
  }

  const result = await createListing(user.id, parsed.data);
  if (!result.ok) {
    return { error: result.error, field: result.field };
  }

  // Optional supporting photo/PDF. Best-effort: a failed upload never rolls
  // back the listing, which is already live and correctly priced — it just
  // surfaces as a warning the seller can retry.
  let evidenceWarning: string | undefined;
  const ticketImage = formData.get("ticketImage");
  if (ticketImage instanceof File && ticketImage.size > 0) {
    const bytes = new Uint8Array(await ticketImage.arrayBuffer());
    const uploadResult = await attachTicketEvidencePhoto(user.id, result.listing.id, {
      bytes,
      name: ticketImage.name,
    });
    if (!uploadResult.ok) evidenceWarning = uploadResult.error;
  }

  revalidatePath("/home");
  revalidatePath("/tickets");
  revalidatePath(`/events/${parsed.data.eventId}`);
  return evidenceWarning ? { evidenceWarning } : {};
}

