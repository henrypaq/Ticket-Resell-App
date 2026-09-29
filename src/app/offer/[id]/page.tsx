import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfferClaimPanel } from "@/components/app/offer-claim-panel";
import { buyerOwnsOffer } from "@/domains/beta-matching/buyer-actions";
import {
  getOfferForBuyer,
  paymentMemoForOffer,
} from "@/domains/beta-matching/service";
import { getBetaEventBySlug } from "@/domains/beta-events/catalog";
import { platformEtransfer } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Your ticket offer · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const offer = await getOfferForBuyer(id);
  if (!offer) notFound();

  const event = await getBetaEventBySlug(offer.event_slug);
  const eventName = event?.name ?? offer.event_slug;
  const isOwner = await buyerOwnsOffer(id);
  const etransfer = platformEtransfer();

  // The buy lead carries the transfer destination and the buyer's own
  // "I got it" stamp; only read it for the owner.
  type LeadRow = { transfer_email: string | null; buyer_confirmed_received_at: string | null };
  let lead: LeadRow | null = null;
  if (isOwner && offer.buy_lead_id) {
    const { data } = await createAdminClient()
      .from("beta_go_leads")
      .select("transfer_email, buyer_confirmed_received_at")
      .eq("id", offer.buy_lead_id)
      .maybeSingle();
    lead = (data as LeadRow | null) ?? null;
  }

  return (
    <OfferClaimPanel
      offerId={offer.id}
      eventName={eventName}
      eventSlug={offer.event_slug}
      flyerUrl={event?.flyerUrl ?? null}
      venueLine={event ? `${event.venue} · ${event.city}` : null}
      priceEach={Number(offer.price_each)}
      status={offer.status}
      declineReason={offer.decline_reason ?? null}
      expiresAt={offer.expires_at}
      paymentDueAt={offer.payment_due_at}
      buyerDeclaredSentAt={offer.buyer_declared_sent_at ?? null}
      ticketTransferredAt={offer.ticket_transferred_at ?? null}
      buyLeadId={offer.buy_lead_id ?? null}
      transferEmail={lead?.transfer_email ?? null}
      receivedConfirmedAt={lead?.buyer_confirmed_received_at ?? null}
      paymentMemo={paymentMemoForOffer(offer.id)}
      etransfer={etransfer}
      isOwner={isOwner}
    />
  );
}
