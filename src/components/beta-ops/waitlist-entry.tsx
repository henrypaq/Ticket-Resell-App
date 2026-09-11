"use client";

import { useState } from "react";
import { LeadCard } from "@/components/beta-ops/lead-card";
import type { OpsWaitlistEntry } from "@/domains/beta-ops/shared";

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

function daysLabel(days: string[]) {
  if (!days.length) return "Interest only (no fixed night)";
  return days.join(" · ");
}

export function WaitlistEntryCard({ entry }: { entry: OpsWaitlistEntry }) {
  if (entry.source === "go" && entry.goLead) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="rounded-full bg-[#6ee1ff]/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#6ee1ff]">
            /go
          </span>
          <span className="rounded-full bg-[#ffe500]/15 px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#ffe500]">
            #{entry.displayedPosition}
          </span>
          <span className="text-[12px] text-muted">{daysLabel(entry.eventDays)}</span>
        </div>
        <LeadCard lead={entry.goLead} />
      </div>
    );
  }

  return (
    <article className="rounded-[18px] border border-hairline bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted">
              Classic
            </span>
            <span className="rounded-full bg-[#ffe500]/15 px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#ffe500]">
              #{entry.displayedPosition}
            </span>
          </div>
          <h2 className="mt-2 text-[17px] font-semibold text-ink">
            {entry.name ?? "Waitlist"}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{formatWhen(entry.createdAt)}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-[13.5px]">
        <Row label="Event" value={entry.eventName} />
        <Row label="Nights" value={daysLabel(entry.eventDays)} />
        <Row label="Tickets" value={`×${entry.quantity}`} />
        <Row label="Email" value={entry.email} href={entry.email ? `mailto:${entry.email}` : null} />
        <Row
          label="WhatsApp"
          value={entry.contactPhone}
          href={
            entry.contactPhone
              ? `https://wa.me/${entry.contactPhone.replace(/\D/g, "")}`
              : null
          }
        />
        <Row
          label="Instagram"
          value={entry.contactInstagram ? `@${entry.contactInstagram}` : null}
          href={
            entry.contactInstagram
              ? `https://instagram.com/${entry.contactInstagram}`
              : null
          }
        />
        {entry.acquisitionChannel && <Row label="Source" value={entry.acquisitionChannel} />}
      </dl>
    </article>
  );
}

function Row({
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
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-all font-medium text-ink">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2"
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
