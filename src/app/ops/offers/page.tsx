import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { OffersBoard } from "@/components/beta-ops/offers-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { listAvailableUnits, listRecentOffers, reconcileExpiredOffers } from "@/domains/beta-matching/service";

export const metadata: Metadata = {
  title: "Offers · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsOffersPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  // Hobby Vercel only allows daily crons — sweep expiries whenever ops opens offers.
  await reconcileExpiredOffers().catch(() => {});

  const [units, offers] = await Promise.all([listAvailableUnits(), listRecentOffers(100)]);

  return (
    <OpsChrome active="offers">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-zinc-100">Ticket offers</h1>
        <p className="mt-1 text-xs text-zinc-400">
          Exclusive unit matching — one live claim per ticket. Near doors, release to open. Mark
          paid records the Interac amount on the offer.
        </p>
      </div>
      <OffersBoard units={units} offers={offers} />
    </OpsChrome>
  );
}
