import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { FakeFrontButton } from "@/components/beta-ops/fake-front";
import { EventsWaitlistBoard } from "@/components/beta-ops/events-waitlist-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { listOpsWaitlistEntries, listQueuePadding } from "@/domains/beta-ops/service";
import { partitionWaitlistEntries } from "@/domains/beta-ops/shared";
import { listCatalogRowsForOps } from "@/domains/beta-events/catalog";
import type { OpsWaitlistEntry } from "@/domains/beta-ops/shared";

export const metadata: Metadata = {
  title: "Events · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsEventsPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  const [events, waitlistEntries, padding] = await Promise.all([
    listCatalogRowsForOps(),
    listOpsWaitlistEntries(),
    listQueuePadding(),
  ]);

  const { active } = partitionWaitlistEntries(waitlistEntries);
  const waitlistBySlug = groupWaitlistBySlug(active);

  return (
    <OpsChrome active="events">
      <EventsWaitlistBoard
        events={events}
        waitlistBySlug={waitlistBySlug}
        fakeFrontSlot={<FakeFrontButton rows={padding} />}
      />
    </OpsChrome>
  );
}

function groupWaitlistBySlug(
  entries: OpsWaitlistEntry[],
): Record<string, OpsWaitlistEntry[]> {
  const map: Record<string, OpsWaitlistEntry[]> = {};
  for (const entry of entries) {
    const list = map[entry.eventSlug] ?? (map[entry.eventSlug] = []);
    list.push(entry);
  }
  for (const slug of Object.keys(map)) {
    map[slug]!.sort((a, b) => a.displayedPosition - b.displayedPosition);
  }
  return map;
}
