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
          <>
            <h1 className="headline text-[28px] leading-tight">Members</h1>
            <p className="mt-2 text-[14px] text-muted">
              Classic questionnaire signups ({members.length}) — including how they found us.
            </p>
          </>
        }
      />

      {bySource.size > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {[...bySource.entries()].map(([channel, count]) => (
            <span
              key={channel}
              className="rounded-full bg-white/8 px-3 py-1.5 text-[12.5px] font-semibold text-muted"
            >
              {channel in ACQUISITION_CHANNEL_LABELS
                ? ACQUISITION_CHANNEL_LABELS[channel as keyof typeof ACQUISITION_CHANNEL_LABELS]
                : channel}{" "}
              · {count}
            </span>
          ))}
        </div>
      )}

      {members.length === 0 ? (
        <p className="mt-8 text-[14px] text-muted">No classic signups yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {members.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      )}
    </OpsChrome>
  );
}
