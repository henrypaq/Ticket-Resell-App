import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { FakeFrontControls } from "@/components/beta-ops/fake-front";
import {
  groupWaitlistByEvent,
  WaitlistEventCards,
} from "@/components/beta-ops/waitlist-entry";
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

  const groups = groupWaitlistByEvent(entries);
  const classicCount = entries.filter((e) => e.source === "classic").length;
  const goCount = entries.filter((e) => e.source === "go").length;

  return (
    <OpsChrome active="waitlist">
      <h1 className="headline text-[28px] leading-tight">Waitlist</h1>
      <p className="mt-2 text-[14px] text-muted">
        Shared queue by event ({groups.length} events · {classicCount} classic · {goCount} /go ·{" "}
        {entries.reduce((n, e) => n + e.quantity, 0)} tickets).
      </p>

      <div className="mt-6">
        <FakeFrontControls rows={padding} />
      </div>

      {groups.length === 0 ? (
        <p className="mt-8 text-[14px] text-muted">No waitlist entries yet.</p>
      ) : (
        <div className="mt-6">
          <WaitlistEventCards groups={groups} />
        </div>
      )}
    </OpsChrome>
  );
}
