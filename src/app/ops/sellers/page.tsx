import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import {
  SellersOffersBoard,
  type OpsOfferRow,
  type OpsUnitRow,
} from "@/components/beta-ops/sellers-offers-board";
import type { SellerEventEntry } from "@/components/beta-ops/sellers-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getTicketEvidenceSignedUrls, listQuickLeads } from "@/domains/beta-ops/service";
import { partitionSellerLeads } from "@/domains/beta-ops/shared";
import { loadBetaCatalog } from "@/domains/beta-events/catalog";
import {
  listRecentOffers,
  listUnitsForSellLeads,
  reconcileExpiredOffers,
} from "@/domains/beta-matching/service";
import { betaEventBySlug, formatNightStamp } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "Sellers · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsSellersPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  await reconcileExpiredOffers().catch(() => {});

  const [leads, catalog] = await Promise.all([
    listQuickLeads({ intent: "sell" }),
    loadBetaCatalog(),
  ]);
  const evidenceUrlLists = await Promise.all(
    leads.map((lead) => getTicketEvidenceSignedUrls(lead.ticketEvidencePath)),
  );

  const entries: SellerEventEntry[] = leads.map((lead, i) => ({
    ...lead,
    eventDays: betaEventBySlug(lead.eventSlug)?.days ?? [],
    evidenceUrls: evidenceUrlLists[i] ?? [],
  }));

  const { active: tonight, past: previous } = partitionSellerLeads(entries, new Date(), catalog);
  tonight.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  previous.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const allIds = entries.map((e) => e.id);
  const [units, offers] = await Promise.all([
    listUnitsForSellLeads(allIds),
    listRecentOffers(200),
  ]);

  // Only keep offers whose unit belongs to one of these sell leads.
  const unitIds = new Set(units.map((u) => u.id));
  const scopedOffers = (offers as OpsOfferRow[]).filter((o) => unitIds.has(o.unit_id));

  return (
    <OpsChrome active="sellers">
      <SellersOffersBoard
        tonight={tonight}
        previous={previous}
        tonightLabel={formatNightStamp()}
        units={units as OpsUnitRow[]}
        offers={scopedOffers}
      />
    </OpsChrome>
  );
}
