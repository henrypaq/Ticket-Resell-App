import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { AddMemberForm, MemberCard } from "@/components/beta-ops/members";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { listClassicMembers } from "@/domains/beta-ops/service";
import { ACQUISITION_CHANNEL_LABELS } from "@/lib/beta-acquisition";

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
      <AddMemberForm
        heading={
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Members</h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400">
              Classic questionnaire signups ({members.length}) — including acquisition source.
            </p>
          </div>
        }
      />

      {bySource.size > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[...bySource.entries()].map(([channel, count]) => (
            <span
              key={channel}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-300"
            >
              <span>
                {channel in ACQUISITION_CHANNEL_LABELS
                  ? ACQUISITION_CHANNEL_LABELS[channel as keyof typeof ACQUISITION_CHANNEL_LABELS]
                  : channel}
              </span>
              <span className="text-zinc-500">· {count}</span>
            </span>
          ))}
        </div>
      )}

      {members.length === 0 ? (
        <p className="mt-8 text-xs text-zinc-500">No classic signups yet.</p>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {members.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      )}
    </OpsChrome>
  );
}
