import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { EventsCatalogBoard } from "@/components/beta-ops/events-catalog-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { listCatalogRowsForOps } from "@/domains/beta-events/catalog";

export const metadata: Metadata = {
  title: "Events · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsEventsPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  const events = await listCatalogRowsForOps();

  return (
    <OpsChrome active="events">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Events</h1>
        <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
          Create nights for the public board — date, title, flyer — then post them live.
        </p>
      </div>
      <EventsCatalogBoard events={events} />
    </OpsChrome>
  );
}
