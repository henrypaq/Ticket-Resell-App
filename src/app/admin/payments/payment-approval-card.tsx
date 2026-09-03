"use client";

import { useActionState, useState } from "react";
import { releasePaymentAction, refundPaymentAction, type AdminFormState } from "@/app/admin/actions";

const initial: AdminFormState = {};

export function PaymentApprovalCard({
  transaction,
  statusLabel,
  formattedAmount,
  stripeConfigured,
}: {
  transaction: {
    id: string;
    amount: number;
    feeAmount: number;
    escrowStatus: string;
    verificationStatus: string;
    createdAt: string;
    adminNote: string | null;
    disputeReason: string | null;
    buyerConfirmedAt: string | null;
  };
  statusLabel: string;
  formattedAmount: string;
  stripeConfigured: boolean;
}) {
  const [releaseState, releaseAction, releasing] = useActionState(releasePaymentAction, initial);
  const [refundState, refundAction, refunding] = useActionState(refundPaymentAction, initial);
  const [mode, setMode] = useState<"idle" | "refund">("idle");
  const [note, setNote] = useState("");

  // Held or disputed are both admin-actionable — a dispute routes to the same
  // release/refund actions, just starting from a different escrow_status
  // (CLAUDE.md § Phase 2's dispute path).
  const held = transaction.escrowStatus === "held" || transaction.escrowStatus === "disputed";
  const done = releaseState.message || refundState.message;

  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold tabular-nums">{formattedAmount}</p>
          <p className="mt-0.5 text-[12px] text-muted">
            {transaction.id.slice(0, 8)} · {new Date(transaction.createdAt).toLocaleDateString("en-CA")}
          </p>
        </div>
        <span
          className={`pill-quiet px-2.5 py-1 text-[11px] ${
            held ? "text-urgency" : "text-muted"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <p className="mt-2 text-[12px] text-muted">
        Verification: {transaction.verificationStatus}
      </p>
      {transaction.buyerConfirmedAt && (
        <p className="mt-1 text-[12.5px] text-muted">
          Buyer confirmed entry {new Date(transaction.buyerConfirmedAt).toLocaleString("en-CA")}
        </p>
      )}
      {transaction.disputeReason && (
        <p className="mt-1 text-[12.5px] text-urgency">Dispute: {transaction.disputeReason}</p>
      )}
      {transaction.adminNote && (
        <p className="mt-1 text-[12.5px] text-muted">Note: {transaction.adminNote}</p>
      )}

      {!held ? (
        <p className="mt-3 text-[12.5px] text-muted">
          {done ?? "No action available — not currently held."}
        </p>
      ) : done ? (
        <p className="mt-3 rounded-xl border border-hairline px-3 py-2 text-[13px] text-muted">
          {done}
        </p>
      ) : (
        <div className="mt-3">
          {mode === "idle" ? (
            <div className="flex flex-wrap gap-2">
              <form action={releaseAction}>
                <input type="hidden" name="transactionId" value={transaction.id} />
                <button
                  type="submit"
                  disabled={releasing || !stripeConfigured}
                  className="rounded-full bg-ink px-4 py-2.5 text-[13px] font-bold text-base disabled:opacity-50"
                >
                  {releasing ? "…" : "Release to seller"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setMode("refund")}
                disabled={!stripeConfigured}
                className="rounded-full border border-hairline px-4 py-2.5 text-[13px] font-semibold text-urgency disabled:opacity-50"
              >
                Refund buyer
              </button>
            </div>
          ) : (
            <form action={refundAction} className="space-y-2">
              <input type="hidden" name="transactionId" value={transaction.id} />
              <input
                name="note"
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for the refund"
                className="pill w-full px-4 py-2 text-[13px] outline-none placeholder:text-muted"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={refunding}
                  className="flex-1 rounded-full bg-urgency/90 px-4 py-2.5 text-[13px] font-bold text-base disabled:opacity-60"
                >
                  {refunding ? "…" : "Confirm refund"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("idle")}
                  className="rounded-full border border-hairline px-4 py-2.5 text-[13px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {(releaseState.error || refundState.error) && (
            <p className="mt-2 text-[12.5px] text-urgency">
              {releaseState.error || refundState.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
