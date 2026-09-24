"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { AddMemberForm } from "@/components/beta-ops/members";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";
import { deleteMemberAction } from "@/domains/beta-ops/actions";
import type { ClassicMemberRow } from "@/domains/beta-ops/shared";
import { ACQUISITION_CHANNEL_LABELS } from "@/lib/beta-acquisition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function sourceLabel(channel: string | null) {
  if (!channel) return "—";
  if (channel in ACQUISITION_CHANNEL_LABELS) {
    return ACQUISITION_CHANNEL_LABELS[channel as keyof typeof ACQUISITION_CHANNEL_LABELS];
  }
  return channel;
}

/**
 * Compact per-row cards (not a table shell). Title stays visible; detail
 * replaces the list only.
 */
export function MembersPanel({
  members,
  bySource,
}: {
  members: ClassicMemberRow[];
  bySource: [string, number][];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollYRef = useRef(0);
  const selected = selectedId ? members.find((m) => m.id === selectedId) : null;

  useEffect(() => {
    if (!selectedId) {
      const y = scrollYRef.current;
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      });
    }
  }, [selectedId]);

  return (
    <div>
      <AddMemberForm
        heading={
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Members</h1>
            <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
              Classic questionnaire signups ({members.length}).
            </p>
          </div>
        }
      />

      {bySource.length > 0 && !selected && (
        <div className="mt-3 flex flex-wrap gap-1">
          {bySource.map(([channel, count]) => (
            <span
              key={channel}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-900/80 px-2 py-0.5 text-[10px] font-medium text-zinc-400"
            >
              {sourceLabel(channel === "(none)" ? null : channel)}
              <span className="text-zinc-600">· {count}</span>
            </span>
          ))}
        </div>
      )}

      {selected ? (
        <div className="mt-5">
          <MemberDetail member={selected} onBack={() => setSelectedId(null)} />
        </div>
      ) : members.length === 0 ? (
        <p className="mt-8 text-xs text-zinc-500">No classic signups yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  scrollYRef.current = window.scrollY;
                  setSelectedId(m.id);
                  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
                }}
                className="flex w-full items-center gap-3 rounded-xl bg-zinc-900/60 px-3.5 py-2.5 text-left transition-colors hover:bg-zinc-900/90 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-semibold text-zinc-100">
                      {m.name}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                      {formatWhen(m.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                    {m.email}
                    {m.phone ? ` · ${m.phone}` : ""}
                    {m.interests.length > 0
                      ? ` · ${m.interests.length} interest${m.interests.length === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <Badge variant="subtle" className="shrink-0 px-1.5 py-0 text-[9px] uppercase">
                  {sourceLabel(m.acquisitionChannel)}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MemberDetail({
  member,
  onBack,
}: {
  member: ClassicMemberRow;
  onBack: () => void;
}) {
  return (
    <div className="rounded-xl bg-zinc-900/60">
      <div className="flex items-center gap-2 border-b border-zinc-800/60 px-3 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 gap-1 px-2 text-xs text-zinc-300 hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
          {member.name}
        </span>
        <OpsDeleteButton
          label="Delete"
          confirmMessage={`Delete ${member.name} (${member.email}) and all their waitlist/sell interests? This cannot be undone.`}
          onConfirm={() => deleteMemberAction(member.id)}
        />
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="subtle" className="text-[10px] uppercase">
            {sourceLabel(member.acquisitionChannel)}
          </Badge>
          <span className="text-[11px] text-zinc-500">Joined {formatWhen(member.createdAt)}</span>
        </div>

        <dl className="grid gap-2.5 text-xs sm:grid-cols-2">
          <DetailRow label="Email" value={member.email} href={`mailto:${member.email}`} />
          <DetailRow label="Phone" value={member.phone || null} />
          <DetailRow label="Intent" value={member.intent} />
          <DetailRow label="Priority" value={member.priority || null} />
          <DetailRow label="Heard via" value={member.referralSource} />
          <DetailRow label="School" value={member.school} />
          <DetailRow
            label="Questionnaire"
            value={
              member.interestedEvents.length
                ? member.interestedEvents.join(", ")
                : null
            }
          />
        </dl>

        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Active interests
          </h2>
          {member.interests.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">No waitlist/sell interests saved.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {member.interests.map((i) => (
                <li
                  key={`${i.eventSlug}-${i.intent}`}
                  className="rounded-lg bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400"
                >
                  <span className="font-medium text-zinc-200">
                    {i.intent === "waitlist" ? "Waitlist" : "Sell"} · {i.eventName}
                  </span>
                  {i.contactPhone ? ` · ${i.contactPhone}` : ""}
                  {i.contactInstagram ? ` · @${i.contactInstagram}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string | null;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-all font-medium text-zinc-200">
        {href ? (
          <a
            href={href}
            className="underline decoration-dotted underline-offset-2 hover:text-zinc-100"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
