import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QueueScreen, QueueUnavailable } from "@/components/app/queue";
import { loadProfilePrefill, loadQueueSeatForBuyer } from "@/domains/beta-quick/actions";
import { loadBetaProfile } from "@/domains/beta-signup/actions";

export const metadata: Metadata = {
  title: "Your queue · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; event?: string; joined?: string }>;
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

  // Just joined and no profile yet: offer account setup under the live line,
  // the job the old /done page did.
  let accountSetup = null;
  if (params.joined === "1" && !(await loadBetaProfile())) {
    const prefill = await loadProfilePrefill();
    if (prefill) {
      const setupPath = `/setup?${new URLSearchParams({ intent: "buy", next: "/" }).toString()}`;
      accountSetup = { prefill, setupPath };
    }
  }

  return <QueueScreen entry={entry} accountSetup={accountSetup} />;
}
