import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfferClaimPanel } from "@/components/app/offer-claim-panel";
import { buyerOwnsOffer } from "@/domains/beta-matching/buyer-actions";
import {
  getOfferForBuyer,
  paymentMemoForOffer,
} from "@/domains/beta-matching/service";
import { betaEventBySlug } from "@/lib/beta-events";
import { platformEtransfer } from "@/lib/env";

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

  const eventName = betaEventBySlug(offer.event_slug)?.name ?? offer.event_slug;
  const isOwner = await buyerOwnsOffer(id);
  const etransfer = platformEtransfer();

  return (
    <OfferClaimPanel
      offerId={offer.id}
      eventName={eventName}
      priceEach={Number(offer.price_each)}
      status={offer.status}
      expiresAt={offer.expires_at}
      paymentDueAt={offer.payment_due_at}
      buyerDeclaredSentAt={offer.buyer_declared_sent_at ?? null}
      paymentMemo={paymentMemoForOffer(offer.id)}
      etransfer={etransfer}
      isOwner={isOwner}
    />
  );
}
