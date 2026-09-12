import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { FakeFrontButton } from "@/components/beta-ops/fake-front";
import { WaitlistEventCards } from "@/components/beta-ops/waitlist-entry";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { listOpsWaitlistEntries, listQueuePadding } from "@/domains/beta-ops/service";
import {
  groupOpsWaitlistByEventDate,
  partitionWaitlistEntries,
} from "@/domains/beta-ops/shared";

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

  const { active: activeEntries } = partitionWaitlistEntries(entries);
  const groups = groupOpsWaitlistByEventDate(activeEntries);

  const classicCount = activeEntries.filter((e) => e.source === "classic").length;
  const goCount = activeEntries.filter((e) => e.source === "go").length;
  const totalTickets = activeEntries.reduce((n, e) => n + e.quantity, 0);

  return (
    <OpsChrome active="waitlist">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Waitlist</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Active queue by date ({groups.length} events · {classicCount} classic · {goCount} /go ·{" "}
            {totalTickets} tickets).
          </p>
        </div>
        <FakeFrontButton rows={padding} />
      </div>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No active waitlist entries.</p>
      ) : (
        <div className="mt-6">
          <WaitlistEventCards groups={groups} />
        </div>
      )}
    </OpsChrome>
  );
}
