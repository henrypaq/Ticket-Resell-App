import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { SellersEventCards, type SellerEventEntry } from "@/components/beta-ops/sellers-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getTicketEvidenceSignedUrls, listQuickLeads } from "@/domains/beta-ops/service";
import { groupOpsEntriesByEvent } from "@/domains/beta-ops/shared";
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

  const groups = groupOpsEntriesByEvent(entries, (a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <OpsChrome active="sellers">
      <h1 className="headline text-[28px] leading-tight">Sellers</h1>
      <p className="mt-2 text-[14px] text-muted">
        Tickets offered by event — open the file or share link to verify, then match the waitlist.
      </p>

      {groups.length === 0 ? (
        <p className="mt-8 text-[14px] text-muted">No seller leads yet.</p>
      ) : (
        <div className="mt-6">
          <SellersEventCards groups={groups} />
        </div>
      )}
    </OpsChrome>
  );
}
