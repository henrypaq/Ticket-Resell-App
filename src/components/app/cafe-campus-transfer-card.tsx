"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { declareSellerTicketSentAction } from "@/domains/beta-quick/actions";
import { BUTTON_CLASS } from "@/components/forms/field-styles";

/**
 * Café Campus custody: sellers transfer e-tickets here so we can verify they
 * haven't been scanned, then we forward to the buyer after payment clears.
 *
 * When `sellLeadId` is set, shows “I’ve transferred the ticket” so ops can
 * pick it up on the Transactions queue.
 */
export function CafeCampusTransferCard({
  name,
  email,
  compact = false,
  sellLeadId,
  alreadyDeclared = false,
}: {
  name: string;
  email: string;
  compact?: boolean;
  sellLeadId?: string | null;
  alreadyDeclared?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [declared, setDeclared] = useState(alreadyDeclared);
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    if (!sellLeadId || declared) return;
    setError(null);
    start(async () => {
      const result = await declareSellerTicketSentAction(sellLeadId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeclared(true);
      router.refresh();
    });
  }

  return (
    <div
      className={
        compact
          ? "rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-4"
          : "rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-5"
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
        Transfer your Café Campus ticket to
      </p>
      <dl className="mt-3 flex flex-col gap-2.5 text-[14px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Name</dt>
          <dd className="text-right font-semibold text-ink">{name}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Email</dt>
          <dd className="break-all text-right font-semibold text-ink">{email}</dd>
        </div>
      </dl>
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
        Transfer the ticket here when you list it (or as soon as it sells). We hold it in custody so
        we can confirm it hasn&apos;t already been scanned. If it doesn&apos;t sell — or you ask us
        to return it — we transfer it back to you.
      </p>

      {sellLeadId && (
        <div className="mt-4">
          {declared ? (
            <p className="rounded-[12px] border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-[13px] font-medium text-emerald-200">
              Got it — we&apos;ll confirm once the ticket lands in our inbox.
            </p>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className={`${BUTTON_CLASS} w-full min-h-[48px] text-[15px] disabled:opacity-60`}
            >
              {pending ? "Saving…" : "I've transferred the ticket"}
            </button>
          )}
          {error && <p className="mt-2 text-[12.5px] text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
