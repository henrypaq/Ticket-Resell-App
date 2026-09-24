import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { MembersPanel } from "@/components/beta-ops/members-panel";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { listClassicMembers } from "@/domains/beta-ops/service";

export const metadata: Metadata = {
  title: "Members · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsMembersPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");
  const members = await listClassicMembers();

  const bySource = new Map<string, number>();
  for (const m of members) {
    const key = m.acquisitionChannel ?? "(none)";
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }

  return (
    <OpsChrome active="members">
      <MembersPanel members={members} bySource={[...bySource.entries()]} />
    </OpsChrome>
  );
}
