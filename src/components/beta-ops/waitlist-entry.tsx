"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWaitlistEntryAction, updateLeadStatusAction } from "@/domains/beta-ops/actions";
import {
  LEAD_STATUSES,
  type LeadStatus,
  type OpsWaitlistEntry,
  type OpsEventGroup,
} from "@/domains/beta-ops/shared";
import { formatBetaEventWhen, type BetaWeekday } from "@/lib/beta-events";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";

function daysLabel(days: string[]) {
  if (!days.length) return "Interest only";
  return days
    .map((d) => {
      try {
        return formatBetaEventWhen(d as BetaWeekday);
      } catch {
        return d;
      }
    })
    .join(" · ");
}

function contactLabel(entry: OpsWaitlistEntry) {
  if (entry.name) return entry.name;
  if (entry.contactInstagram) return `@${entry.contactInstagram}`;
  if (entry.contactPhone) return entry.contactPhone;
  if (entry.email) return entry.email;
  return "Anonymous";
}

function contactHref(entry: OpsWaitlistEntry) {
  if (entry.contactPhone) {
    return `https://wa.me/${entry.contactPhone.replace(/\D/g, "")}`;
  }
  if (entry.contactInstagram) {
    return `https://instagram.com/${entry.contactInstagram}`;
  }
  if (entry.email) return `mailto:${entry.email}`;
  return null;
}

export type WaitlistEventGroup = OpsEventGroup<OpsWaitlistEntry>;

export function WaitlistEventCards({ groups }: { groups: WaitlistEventGroup[] }) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <WaitlistEventCard key={group.eventSlug} group={group} />
      ))}
    </div>
  );
}

function WaitlistEventCard({ group }: { group: WaitlistEventGroup }) {
  const [open, setOpen] = useState(false);
  const dateLine = daysLabel(group.eventDays);

  return (
    <section className="overflow-hidden rounded-[16px] border border-hairline bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{group.eventName}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted">{dateLine}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-semibold tabular-nums text-ink">
            {group.entries.length} in line
          </p>
          <p className="text-[11px] text-muted">×{group.ticketDemand} tickets</p>
        </div>
        <span className="shrink-0 text-[12px] font-semibold text-muted">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <ul className="border-t border-hairline">
          {group.entries.map((entry) => (
            <WaitlistMemberRow key={`${entry.source}-${entry.id}`} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

function WaitlistMemberRow({ entry }: { entry: OpsWaitlistEntry }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const href = contactHref(entry);
  const label = contactLabel(entry);

  function setStatus(status: LeadStatus) {
    if (!entry.goLead) return;
    start(async () => {
      await updateLeadStatusAction(entry.goLead!.id, status);
      router.refresh();
    });
  }

  return (
    <li className="border-b border-hairline/70 last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="w-8 shrink-0 text-[12px] font-bold tabular-nums text-[#ffe500]">
          #{entry.displayedPosition}
        </span>
        <div className="min-w-0 flex-1">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[13px] font-medium text-ink underline decoration-dotted underline-offset-2"
            >
              {label}
            </a>
          ) : (
            <p className="truncate text-[13px] font-medium text-ink">{label}</p>
          )}
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted">×{entry.quantity}</span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            entry.source === "go"
              ? "bg-[#6ee1ff]/15 text-[#6ee1ff]"
              : "bg-white/10 text-muted"
          }`}
        >
          {entry.source === "go" ? "go" : "app"}
        </span>
        {entry.source === "go" && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-[11px] font-semibold text-muted"
            aria-expanded={expanded}
          >
            {expanded ? "Less" : "More"}
          </button>
        )}
        <OpsDeleteButton
          confirmMessage={`Remove #${entry.displayedPosition} (${contactLabel(entry)}) from ${entry.eventName}? This deletes them from the database.`}
          onConfirm={() => deleteWaitlistEntryAction(entry.source, entry.id)}
        />
      </div>

      {expanded && entry.goLead && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2 pl-11">
          {LEAD_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending || entry.status === s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                entry.status === s
                  ? "bg-[#ffe500] text-black"
                  : "bg-white/8 text-muted disabled:opacity-40"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

export function CollapsiblePanel({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[18px] border border-hairline bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{title}</p>
          {summary && !open && (
            <p className="mt-0.5 truncate text-[12.5px] text-muted">{summary}</p>
          )}
        </div>
        <span className="shrink-0 text-[13px] font-semibold text-muted">
          {open ? "Hide" : "Edit"}
        </span>
      </button>
      {open && <div className="border-t border-hairline px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}
