import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QueueScreen, QueueUnavailable } from "@/components/app/queue";
import { loadQueueSeatForBuyer } from "@/domains/beta-quick/actions";

export const metadata: Metadata = {
  title: "Your queue · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; event?: string }>;
}) {
  const params = await searchParams;
  const leadId = params.lead && /^[0-9a-f-]{36}$/i.test(params.lead) ? params.lead : null;

  if (!leadId) {
    redirect("/");
  }

  const entry = await loadQueueSeatForBuyer(leadId);
  if (!entry) {
    return <QueueUnavailable />;
  }

  return <QueueScreen entry={entry} />;
}
