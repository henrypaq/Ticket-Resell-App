"use client";

import { useState } from "react";
import { LeadCard } from "@/components/beta-ops/lead-card";
import type { OpsEventGroup } from "@/domains/beta-ops/shared";
import type { QuickLeadRow } from "@/domains/beta-ops/shared";
import { formatBetaEventWhen, type BetaWeekday } from "@/lib/beta-events";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";
import { deleteLeadAction } from "@/domains/beta-ops/actions";

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
  evidenceUrl: string | null;
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
    <section className="overflow-hidden rounded-[16px] border border-hairline bg-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{group.eventName}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted">{daysLabel(group.eventDays)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-semibold tabular-nums text-ink">
            {group.entries.length} seller{group.entries.length === 1 ? "" : "s"}
          </p>
          <p className="text-[11px] text-muted">×{group.ticketDemand} tickets</p>
        </div>
        <span className="shrink-0 text-[12px] font-semibold text-muted">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <ul className="border-t border-hairline">
          {group.entries.map((lead) => (
            <SellerRow key={lead.id} lead={lead} />
          ))}
        </ul>
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
    <li className="border-b border-hairline/70 last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">{contact}</p>
          <p className="truncate text-[11px] text-muted">
            ×{lead.quantity}
            {lead.paidEach != null && lead.askEach != null
              ? ` · $${lead.paidEach.toFixed(0)}→$${lead.askEach.toFixed(0)}`
              : ""}
            {` · ${lead.status}`}
          </p>
        </div>
        {lead.evidenceUrl ? (
          <a
            href={lead.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-[#ffe500]/15 px-2.5 py-1 text-[11px] font-bold text-[#ffe500]"
          >
            Open file
          </a>
        ) : null}
        {lead.ticketShareUrl ? (
          <a
            href={lead.ticketShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-ink"
          >
            Open link
          </a>
        ) : null}
        {!lead.evidenceUrl && !lead.ticketShareUrl ? (
          <span className="shrink-0 text-[11px] text-muted">No proof</span>
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-[11px] font-semibold text-muted"
        >
          {expanded ? "Less" : "More"}
        </button>
        <OpsDeleteButton
          confirmMessage={`Delete seller lead for ${lead.eventName}? This removes it from the database${lead.ticketEvidencePath ? " and deletes the upload" : ""}.`}
          onConfirm={() => deleteLeadAction(lead.id)}
        />
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <LeadCard lead={lead} evidenceUrl={lead.evidenceUrl} />
        </div>
      )}
    </li>
  );
}
