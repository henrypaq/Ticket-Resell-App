"use client";

import { useActionState, useState } from "react";
import { confirmEntryAction, openDisputeAction, type BuyerActionFormState } from "@/domains/payments/actions";

const initial: BuyerActionFormState = {};

/**
 * The Tier B release signal (CLAUDE.md § Phase 2): once an event has passed
 * and the payment is still held, the buyer either confirms they got in
 * (releases the payment to the seller immediately) or reports a problem
 * (routes to escrow_status = 'disputed' for an admin to resolve). Left alone,
 * a scheduled sweep releases it automatically after the timeout — see
 * domains/payments/auto-release.ts.
 */
export function PurchaseActions({
  transactionId,
  eventHasPassed,
}: {
  transactionId: string;
  /** Confirming entry only makes sense after the event happened; reporting a problem doesn't need to wait. */
  eventHasPassed: boolean;
}) {
  const [confirmState, confirmAction, confirming] = useActionState(confirmEntryAction, initial);
  const [disputeState, disputeAction, disputing] = useActionState(openDisputeAction, initial);
  const [mode, setMode] = useState<"idle" | "dispute">("idle");
  const [reason, setReason] = useState("");

  const done = confirmState.message || disputeState.message;
  if (done) {
    return <p className="mt-3 rounded-xl border border-hairline px-3 py-2 text-[13px] text-muted">{done}</p>;
  }

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      <p className="text-[12.5px] text-muted">
        {eventHasPassed ? "Did you get in okay?" : "Something wrong with this purchase?"}
      </p>
      {mode === "idle" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {eventHasPassed && (
            <form action={confirmAction}>
              <input type="hidden" name="transactionId" value={transactionId} />
              <button
                type="submit"
                disabled={confirming}
                className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-base disabled:opacity-50"
              >
                {confirming ? "…" : "Yes, release payment"}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() => setMode("dispute")}
            className="rounded-full border border-hairline px-4 py-2 text-[12.5px] font-semibold text-urgency"
          >
            Report a problem
          </button>
        </div>
      ) : (
        <form action={disputeAction} className="mt-2 space-y-2">
          <input type="hidden" name="transactionId" value={transactionId} />
          <textarea
            name="reason"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What happened?"
            rows={2}
            className="pill w-full px-4 py-2 text-[13px] outline-none placeholder:text-muted"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={disputing}
              className="flex-1 rounded-full bg-urgency/90 px-4 py-2 text-[12.5px] font-bold text-base disabled:opacity-60"
            >
              {disputing ? "…" : "Submit report"}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="rounded-full border border-hairline px-4 py-2 text-[12.5px]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {(confirmState.error || disputeState.error) && (
        <p className="mt-2 text-[12px] text-urgency">{confirmState.error || disputeState.error}</p>
      )}
    </div>
  );
}
