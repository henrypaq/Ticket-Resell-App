"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateLeadNotesAction,
  updateLeadStatusAction,
  type OpsActionState,
} from "@/domains/beta-ops/actions";
import {
  LEAD_STATUSES,
  type LeadStatus,
  type QuickLeadRow,
} from "@/domains/beta-ops/service";
import { BUTTON_CLASS_COMPACT, FIELD_CLASS } from "@/components/beta-waitlist/field-styles";

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
}: {
  lead: QuickLeadRow;
  evidenceUrl?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notesState, notesAction, notesPending] = useActionState(
    updateLeadNotesAction,
    {} as OpsActionState,
  );

  function setStatus(status: LeadStatus) {
    start(async () => {
      await updateLeadStatusAction(lead.id, status);
      router.refresh();
    });
  }

  return (
    <article className="rounded-[18px] border border-hairline bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {lead.intent === "buy" ? "Needs ticket" : "Has ticket"} · {STATUS_LABEL[lead.status]}
          </p>
          <h2 className="mt-1 text-[17px] font-semibold text-ink">{lead.eventName}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{formatWhen(lead.createdAt)}</p>
        </div>
        <p className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold tabular-nums text-ink">
          ×{lead.quantity}
        </p>
      </div>

      <dl className="mt-4 space-y-2 text-[13.5px]">
        <Row label="WhatsApp" value={lead.contactPhone} href={lead.contactPhone ? `https://wa.me/${lead.contactPhone.replace(/\D/g, "")}` : null} />
        <Row
          label="Instagram"
          value={lead.contactInstagram ? `@${lead.contactInstagram}` : null}
          href={lead.contactInstagram ? `https://instagram.com/${lead.contactInstagram}` : null}
        />
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
            {evidenceUrl && (
              <Row label="Screenshot" value="Open upload" href={evidenceUrl} />
            )}
            <Row label="Interac name" value={lead.etransferName} />
            <Row label="Interac email" value={lead.etransferEmail} />
            <Row label="Interac phone" value={lead.etransferPhone} />
          </>
        )}
        {lead.acquisitionChannel && (
          <Row label="Source" value={lead.acquisitionChannel} />
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {LEAD_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || lead.status === s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              lead.status === s
                ? "bg-[#ffe500] text-black"
                : "bg-white/8 text-muted hover:bg-white/12 hover:text-ink disabled:opacity-40"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <form
        action={async (fd) => {
          await notesAction(fd);
          router.refresh();
        }}
        className="mt-4 flex flex-col gap-2"
      >
        <input type="hidden" name="id" value={lead.id} />
        <textarea
          name="adminNotes"
          defaultValue={lead.adminNotes ?? ""}
          placeholder="Notes for Gaspar / Henry…"
          rows={2}
          className={`${FIELD_CLASS} min-h-[72px] resize-y text-[14px]`}
        />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={notesPending} className={BUTTON_CLASS_COMPACT}>
            {notesPending ? "Saving…" : "Save notes"}
          </button>
          {notesState.error && (
            <span className="text-[12px] text-urgency">{notesState.error}</span>
          )}
          {notesState.ok && <span className="text-[12px] text-muted">Saved</span>}
        </div>
      </form>
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
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
