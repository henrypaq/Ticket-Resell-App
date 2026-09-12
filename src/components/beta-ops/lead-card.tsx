"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteLeadAction,
  updateLeadNotesAction,
  updateLeadStatusAction,
  type OpsActionState,
} from "@/domains/beta-ops/actions";
import {
  LEAD_STATUSES,
  type LeadStatus,
  type QuickLeadRow,
} from "@/domains/beta-ops/shared";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  matched: "Matched",
  done: "Done",
  cancelled: "Cancelled",
};

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

export function LeadCard({
  lead,
  evidenceUrl,
  evidenceUrls,
}: {
  lead: QuickLeadRow;
  evidenceUrl?: string | null;
  evidenceUrls?: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notesState, notesAction, notesPending] = useActionState(
    updateLeadNotesAction,
    {} as OpsActionState,
  );
  const proofUrls = evidenceUrls?.length ? evidenceUrls : evidenceUrl ? [evidenceUrl] : [];

  function setStatus(status: LeadStatus) {
    start(async () => {
      await updateLeadStatusAction(lead.id, status);
      router.refresh();
    });
  }

  return (
    <article className="rounded-xl bg-zinc-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {lead.intent === "buy" ? "Needs ticket" : "Has ticket"}
            </span>
            <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
              {STATUS_LABEL[lead.status]}
            </Badge>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-zinc-100">{lead.eventName}</h3>
          <p className="mt-0.5 text-xs text-zinc-400">{formatWhen(lead.createdAt)}</p>
        </div>
        <Badge variant="subtle" className="text-xs font-semibold tabular-nums">
          ×{lead.quantity}
        </Badge>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        <Row label="WhatsApp" value={lead.contactPhone} href={lead.contactPhone ? `https://wa.me/${lead.contactPhone.replace(/\D/g, "")}` : null} />
        <Row
          label="Instagram"
          value={lead.contactInstagram ? `@${lead.contactInstagram}` : null}
          href={lead.contactInstagram ? `https://instagram.com/${lead.contactInstagram}` : null}
        />
        {lead.intent === "buy" && (
          <>
            <Row
              label="Transfer name"
              value={
                [lead.transferFirstName, lead.transferLastName].filter(Boolean).join(" ") || null
              }
            />
            <Row
              label="Transfer email"
              value={lead.transferEmail}
              href={lead.transferEmail ? `mailto:${lead.transferEmail}` : null}
            />
          </>
        )}
        {lead.intent === "sell" && (
          <>
            <Row
              label="Paid → ask"
              value={
                lead.paidEach != null && lead.askEach != null
                  ? `$${lead.paidEach.toFixed(2)} → $${lead.askEach.toFixed(2)}`
                  : null
              }
            />
            <Row label="Ticket link" value={lead.ticketShareUrl} href={lead.ticketShareUrl} />
            {proofUrls.map((url, i) => (
              <Row
                key={url}
                label={proofUrls.length > 1 ? `Proof ${i + 1}` : "Proof"}
                value="Open upload"
                href={url}
              />
            ))}
            <Row label="Interac name" value={lead.etransferName} />
            <Row label="Interac email" value={lead.etransferEmail} />
            <Row label="Interac phone" value={lead.etransferPhone} />
          </>
        )}
        {lead.acquisitionChannel && (
          <Row label="Source" value={lead.acquisitionChannel} />
        )}
      </dl>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {LEAD_STATUSES.map((s) => (
          <Button
            key={s}
            type="button"
            variant={lead.status === s ? "default" : "secondary"}
            size="sm"
            disabled={pending || lead.status === s}
            onClick={() => setStatus(s)}
            className="h-6 rounded-md px-2 text-[11px] font-medium"
          >
            {STATUS_LABEL[s]}
          </Button>
        ))}
      </div>

      <form
        action={async (fd) => {
          await notesAction(fd);
          router.refresh();
        }}
        className="mt-3.5 flex flex-col gap-2"
      >
        <input type="hidden" name="id" value={lead.id} />
        <textarea
          name="adminNotes"
          defaultValue={lead.adminNotes ?? ""}
          placeholder="Notes for Gaspar / Henry…"
          rows={2}
          className="w-full rounded-md bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary" size="sm" disabled={notesPending} className="h-7 rounded-md text-xs">
            {notesPending ? "Saving…" : "Save notes"}
          </Button>
          {notesState.error && (
            <span className="text-xs text-amber-400">{notesState.error}</span>
          )}
        </div>
      </form>

      <div className="mt-3 flex justify-end">
        <OpsDeleteButton
          label="Delete lead"
          confirmMessage={`Delete lead for ${lead.contactInstagram ? `@${lead.contactInstagram}` : lead.contactPhone} (${lead.eventName})? This also deletes uploaded ticket proof.`}
          onConfirm={() => deleteLeadAction(lead.id)}
        />
      </div>
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
    <div className="flex gap-2.5">
      <dt className="w-24 shrink-0 text-zinc-400">{label}</dt>
      <dd className="min-w-0 break-all font-medium text-zinc-200">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
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
