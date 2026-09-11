import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { FakeFrontControls } from "@/components/beta-ops/fake-front";
import { WaitlistEntryCard } from "@/components/beta-ops/waitlist-entry";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { listOpsWaitlistEntries, listQueuePadding } from "@/domains/beta-ops/service";

export const metadata: Metadata = {
  title: "Waitlist · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsWaitlistPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");
  const [entries, padding] = await Promise.all([
    listOpsWaitlistEntries(),
    listQueuePadding(),
  ]);

  const classicCount = entries.filter((e) => e.source === "classic").length;
  const goCount = entries.filter((e) => e.source === "go").length;

  return (
    <OpsChrome active="waitlist">
      <h1 className="headline text-[28px] leading-tight">Waitlist</h1>
      <p className="mt-2 text-[14px] text-muted">
        Shared queue across classic + /go ({classicCount} classic · {goCount} /go ·{" "}
        {entries.reduce((n, e) => n + e.quantity, 0)} tickets asked).
      </p>

      <div className="mt-6">
        <FakeFrontControls rows={padding} />
      </div>

      {entries.length === 0 ? (
        <p className="mt-8 text-[14px] text-muted">No waitlist entries yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {entries.map((entry) => (
            <WaitlistEntryCard key={`${entry.source}-${entry.id}`} entry={entry} />
          ))}
        </div>
      )}
    </OpsChrome>
  );
}
