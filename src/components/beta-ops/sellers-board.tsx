"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { LeadCard } from "@/components/beta-ops/lead-card";
import type { OpsEventGroup, QuickLeadRow } from "@/domains/beta-ops/shared";
import { formatBetaEventWhen, type BetaWeekday } from "@/lib/beta-events";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";
import { deleteLeadAction } from "@/domains/beta-ops/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

export type SellerEventEntry = QuickLeadRow & {
  eventDays: string[];
  evidenceUrls: string[];
};

export function SellersEventCards({
  groups,
}: {
  groups: OpsEventGroup<SellerEventEntry>[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <SellerEventCard key={group.eventSlug} group={group} />
      ))}
    </div>
  );
}

function SellerEventCard({ group }: { group: OpsEventGroup<SellerEventEntry> }) {
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
          <h2 className="truncate text-sm sm:text-base font-semibold text-zinc-100">
            {group.eventName}
          </h2>
          <p className="mt-0.5 truncate text-xs text-zinc-400">{daysLabel(group.eventDays)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs sm:text-sm font-semibold tabular-nums text-zinc-200">
            {group.entries.length} seller{group.entries.length === 1 ? "" : "s"}
          </p>
          <p className="text-[11px] text-zinc-400">×{group.ticketDemand} tickets</p>
        </div>
        <span className="shrink-0 text-zinc-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="mt-3 pt-2">
          <ul className="flex flex-col gap-1">
            {group.entries.map((lead) => (
              <SellerRow key={lead.id} lead={lead} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SellerRow({ lead }: { lead: SellerEventEntry }) {
  const [expanded, setExpanded] = useState(false);
  const contact =
    lead.contactInstagram
      ? `@${lead.contactInstagram}`
      : lead.contactPhone || "No contact";

  return (
    <li className="rounded-lg bg-zinc-950/40 p-2.5 transition-colors hover:bg-zinc-950/70">
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium text-zinc-200">{contact}</span>
            <Badge variant="subtle" className="text-[10px] px-1.5 py-0">
              ×{lead.quantity}
            </Badge>
            {lead.paidEach != null && lead.askEach != null && (
              <span className="text-[11px] text-zinc-400 tabular-nums">
                ${lead.paidEach.toFixed(0)}→${lead.askEach.toFixed(0)}
              </span>
            )}
            <Badge variant="secondary" className="text-[10px] uppercase px-1.5 py-0">
              {lead.status}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {lead.evidenceUrls.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
            >
              {lead.evidenceUrls.length > 1 ? `File ${i + 1}` : "File"}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
          {lead.ticketShareUrl && (
            <a
              href={lead.ticketShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
            >
              Link
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {!lead.evidenceUrls.length && !lead.ticketShareUrl && (
            <span className="text-[11px] text-zinc-500">No proof</span>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="h-6 px-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 rounded-md"
            aria-expanded={expanded}
          >
            {expanded ? "Less" : "Edit"}
          </Button>

          <OpsDeleteButton
            confirmMessage={`Delete seller lead for ${contact} (${lead.eventName})? This removes evidence and cannot be undone.`}
            onConfirm={() => deleteLeadAction(lead.id)}
          />
        </div>
      </div>

      {expanded && (
        <div className="mt-2.5 pt-2">
          <LeadCard
            lead={lead}
            evidenceUrls={lead.evidenceUrls}
            evidenceUrl={lead.evidenceUrls[0]}
          />
        </div>
      )}
    </li>
  );
}
