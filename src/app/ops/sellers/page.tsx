import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { SellersEventCards, type SellerEventEntry } from "@/components/beta-ops/sellers-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getTicketEvidenceSignedUrls, listQuickLeads } from "@/domains/beta-ops/service";
import { groupOpsEntriesByEvent, partitionSellerLeads } from "@/domains/beta-ops/shared";
import { betaEventBySlug } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "Sellers · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsSellersPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  const leads = await listQuickLeads({ intent: "sell" });
  const evidenceUrlLists = await Promise.all(
    leads.map((lead) => getTicketEvidenceSignedUrls(lead.ticketEvidencePath)),
  );

  const entries: SellerEventEntry[] = leads.map((lead, i) => ({
    ...lead,
    eventDays: betaEventBySlug(lead.eventSlug)?.days ?? [],
    evidenceUrls: evidenceUrlLists[i] ?? [],
  }));

  const { active: activeEntries } = partitionSellerLeads(entries);

  const groups = groupOpsEntriesByEvent(activeEntries, (a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const totalTickets = activeEntries.reduce((sum, e) => sum + e.quantity, 0);

  return (
    <OpsChrome active="sellers">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Sellers</h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-400">
          Active ticket offers for tonight ({activeEntries.length} sellers · {totalTickets} tickets) — verify proof, then match the waitlist.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No active seller leads for tonight.</p>
      ) : (
        <div className="mt-6">
          <SellersEventCards groups={groups} />
        </div>
      )}
    </OpsChrome>
  );
}
