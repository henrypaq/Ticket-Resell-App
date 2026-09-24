import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { BuyersBoard, type BuyerOfferRow } from "@/components/beta-ops/buyers-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { listOpsWaitlistEntries } from "@/domains/beta-ops/service";
import { partitionWaitlistEntries } from "@/domains/beta-ops/shared";
import { listRecentOffers } from "@/domains/beta-matching/service";

export const metadata: Metadata = {
  title: "Buyers · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsBuyersPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  const [entries, offers] = await Promise.all([
    listOpsWaitlistEntries(),
    listRecentOffers(200),
  ]);

  const { active: tonight, past: previous } = partitionWaitlistEntries(entries);
  tonight.sort((a, b) => a.displayedPosition - b.displayedPosition);
  previous.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <OpsChrome active="buyers">
      <BuyersBoard
        tonight={tonight}
        previous={previous}
        offers={offers as BuyerOfferRow[]}
      />
    </OpsChrome>
  );
}
