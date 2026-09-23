import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { EventRequestsBoard } from "@/components/beta-ops/event-requests-board";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import {
  listOpsEventRequests,
  markAllEventRequestsSeen,
} from "@/domains/beta-ops/event-requests";

export const metadata: Metadata = {
  title: "Requests · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsEventRequestsPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  // Opening the tab clears the iOS-style badge.
  await markAllEventRequestsSeen();
  const requests = await listOpsEventRequests();

  return (
    <OpsChrome active="requests">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Requests</h1>
        <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
          Events people asked us to add. Badge clears when you open this tab.
        </p>
      </div>
      <EventRequestsBoard requests={requests} />
    </OpsChrome>
  );
}
