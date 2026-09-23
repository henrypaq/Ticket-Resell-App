import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayoutConfirmPanel } from "@/components/app/payout-confirm";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBetaEventBySlug } from "@/domains/beta-events/catalog";

export const metadata: Metadata = {
  title: "Confirm payout · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PayoutConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string }>;
}) {
  const { offer: offerId } = await searchParams;
  if (!offerId || !/^[0-9a-f-]{36}$/i.test(offerId)) notFound();

  const admin = createAdminClient();
  const { data: offer } = await admin
    .from("beta_offers")
    .select(
      "id, status, event_slug, price_each, payment_amount, payout_released_at, seller_payout_confirmed_at",
    )
    .eq("id", offerId)
    .maybeSingle();

  if (!offer || offer.status !== "paid") notFound();

  const event = await getBetaEventBySlug(offer.event_slug as string);
  const amount = Number(offer.payment_amount ?? offer.price_each);

  return (
    <PayoutConfirmPanel
      offerId={offer.id as string}
      eventName={event?.name ?? (offer.event_slug as string)}
      amount={amount}
      alreadyConfirmed={Boolean(offer.seller_payout_confirmed_at)}
      payoutReleased={Boolean(offer.payout_released_at)}
    />
  );
}
