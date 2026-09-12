"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { deleteWaitlistEntryAction, updateLeadStatusAction } from "@/domains/beta-ops/actions";
import {
  LEAD_STATUSES,
  type LeadStatus,
  type OpsWaitlistEntry,
  type OpsWaitlistGroup,
} from "@/domains/beta-ops/shared";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

export function WaitlistEventCards({ groups }: { groups: OpsWaitlistGroup[] }) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <WaitlistEventCard key={group.key} group={group} />
      ))}
    </div>
  );
}

function WaitlistEventCard({ group }: { group: OpsWaitlistGroup }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="rounded-xl bg-zinc-900/60 p-4 transition-colors">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left focus:outline-none"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm sm:text-base font-semibold text-zinc-100">
              {group.eventName}
            </h2>
            {group.isTonight && (
              <Badge variant="accent" className="text-[10px] px-1.5 py-0 font-medium">
                Tonight
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-400">{group.dateLabel}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs sm:text-sm font-semibold tabular-nums text-zinc-200">
            {group.entries.length} in line
          </p>
          <p className="text-[11px] text-zinc-400">×{group.ticketDemand} tickets</p>
        </div>
        <span className="shrink-0 text-zinc-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="mt-3 pt-2">
          {group.entries.length === 0 ? (
            <p className="py-2 text-xs text-zinc-500">No active waitlist joiners for this date.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {group.entries.map((entry) => (
                <WaitlistMemberRow key={`${entry.source}-${entry.id}`} entry={entry} />
              ))}
            </ul>
          )}
        </div>
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
    <li className="rounded-lg bg-zinc-950/40 p-2.5 transition-colors hover:bg-zinc-950/70">
      <div className="flex items-center gap-2.5">
        <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-zinc-400">
          #{entry.displayedPosition}
        </span>
        <div className="min-w-0 flex-1">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs font-medium text-zinc-200 hover:underline"
            >
              {label}
            </a>
          ) : (
            <p className="truncate text-xs font-medium text-zinc-200">{label}</p>
          )}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-zinc-400">×{entry.quantity}</span>
        <Badge
          variant={entry.source === "go" ? "secondary" : "subtle"}
          className="text-[10px] uppercase px-1.5 py-0"
        >
          {entry.source}
        </Badge>
        {entry.source === "go" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="h-6 px-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 rounded-md"
            aria-expanded={expanded}
          >
            {expanded ? "Less" : "Status"}
          </Button>
        )}
        <OpsDeleteButton
          confirmMessage={`Remove #${entry.displayedPosition} (${contactLabel(entry)}) from ${entry.eventName}? This deletes them from the database.`}
          onConfirm={() => deleteWaitlistEntryAction(entry.source, entry.id)}
        />
      </div>

      {expanded && entry.goLead && (
        <div className="mt-2 flex flex-wrap gap-1 pl-9 pt-1">
          {LEAD_STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              variant={entry.status === s ? "default" : "secondary"}
              size="sm"
              disabled={pending || entry.status === s}
              onClick={() => setStatus(s)}
              className="h-6 rounded-md px-2 text-[10px] font-medium"
            >
              {s}
            </Button>
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
    <div className="rounded-xl bg-zinc-900/60 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left focus:outline-none"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-200">{title}</p>
          {summary && !open && (
            <p className="mt-0.5 truncate text-xs text-zinc-400">{summary}</p>
          )}
        </div>
        <span className="text-xs font-medium text-zinc-400">
          {open ? "Hide" : "Edit"}
        </span>
      </button>
      {open && <div className="mt-3 pt-2">{children}</div>}
    </div>
  );
}
