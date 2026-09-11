import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { LeadCard } from "@/components/beta-ops/lead-card";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getTicketEvidenceSignedUrl, listQuickLeads } from "@/domains/beta-ops/service";

export const metadata: Metadata = {
  title: "Sellers · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsSellersPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  const leads = await listQuickLeads({ intent: "sell" });
  const evidenceUrls = await Promise.all(
    leads.map((lead) => getTicketEvidenceSignedUrl(lead.ticketEvidencePath)),
  );

  return (
    <OpsChrome active="sellers">
      <h1 className="headline text-[28px] leading-tight">Sellers</h1>
      <p className="mt-2 text-[14px] text-muted">
        Tickets offered — prices, Interac, and proof. Match to the waitlist.
      </p>

      {leads.length === 0 ? (
        <p className="mt-8 text-[14px] text-muted">No seller leads yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {leads.map((lead, i) => (
            <LeadCard key={lead.id} lead={lead} evidenceUrl={evidenceUrls[i]} />
          ))}
        </div>
      )}
    </OpsChrome>
  );
}
