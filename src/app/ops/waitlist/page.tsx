import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { FakeFrontControls } from "@/components/beta-ops/fake-front";
import { LeadCard } from "@/components/beta-ops/lead-card";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { listQuickLeads, listQueuePadding } from "@/domains/beta-ops/service";

export const metadata: Metadata = {
  title: "Waitlist · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsWaitlistPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");
  const [leads, padding] = await Promise.all([
    listQuickLeads({ intent: "buy" }),
    listQueuePadding(),
  ]);

  return (
    <OpsChrome active="waitlist">
      <h1 className="headline text-[28px] leading-tight">Waitlist</h1>
      <p className="mt-2 text-[14px] text-muted">
        People who need tickets — contact them when a seller matches.
      </p>

      <div className="mt-6">
        <FakeFrontControls rows={padding} />
      </div>

      {leads.length === 0 ? (
        <p className="mt-8 text-[14px] text-muted">No waitlist leads yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </OpsChrome>
  );
}
