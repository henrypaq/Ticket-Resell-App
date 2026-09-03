"use client";

import { useActionState, useState } from "react";
import {
  flagListingAction,
  removeListingAction,
  unflagListingAction,
  type AdminFormState,
} from "@/app/admin/actions";

const initial: AdminFormState = {};

export function ListingModerationCard({
  listing,
  statusLabel,
  formattedPrice,
}: {
  listing: {
    id: string;
    price: number;
    status: string;
    flaggedAt: string | null;
    flaggedReason: string | null;
    removedAt: string | null;
    createdAt: string;
  };
  statusLabel: string;
  formattedPrice: string;
}) {
  const [flagState, flagAction, flagging] = useActionState(flagListingAction, initial);
  const [removeState, removeAction, removing] = useActionState(removeListingAction, initial);
  const [mode, setMode] = useState<"idle" | "flag" | "remove">("idle");
  const [reason, setReason] = useState("");

  const removed = Boolean(listing.removedAt);
  const flagged = Boolean(listing.flaggedAt) && !removed;

  return (
    <div className={`surface rounded-2xl p-4 ${removed ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold tabular-nums">{formattedPrice}</p>
          <p className="mt-0.5 text-[12px] text-muted">
            {listing.id.slice(0, 8)} · {new Date(listing.createdAt).toLocaleDateString("en-CA")}
          </p>
        </div>
        <div className="flex gap-1.5">
          {flagged && (
            <span className="pill-quiet px-2.5 py-1 text-[11px] font-semibold text-urgency">
              Flagged
            </span>
          )}
          <span className="pill-quiet px-2.5 py-1 text-[11px]">{statusLabel}</span>
        </div>
      </div>

      {listing.flaggedReason && (
        <p className="mt-2 text-[12.5px] text-muted">Reason: {listing.flaggedReason}</p>
      )}

      {removed ? (
        <p className="mt-3 text-[12.5px] text-muted">Removed.</p>
      ) : (
        <div className="mt-3">
          {mode === "idle" && (
            <div className="flex flex-wrap gap-2">
              {flagged ? (
                <form action={unflagListingAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-hairline px-3.5 py-2 text-[12.5px] font-semibold"
                  >
                    Clear flag
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("flag")}
                  className="rounded-full border border-hairline px-3.5 py-2 text-[12.5px] font-semibold"
                >
                  Flag
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("remove")}
                className="rounded-full border border-hairline px-3.5 py-2 text-[12.5px] font-semibold text-urgency"
              >
                Remove
              </button>
            </div>
          )}

          {mode === "flag" && (
            <form action={flagAction} className="space-y-2">
              <input type="hidden" name="listingId" value={listing.id} />
              <input
                name="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for the flag"
                className="pill w-full px-4 py-2 text-[13px] outline-none placeholder:text-muted"
              />
              <FormButtons pending={flagging} onCancel={() => setMode("idle")} label="Flag" />
              {flagState.error && <p className="text-[12px] text-urgency">{flagState.error}</p>}
            </form>
          )}

          {mode === "remove" && (
            <form action={removeAction} className="space-y-2">
              <input type="hidden" name="listingId" value={listing.id} />
              <input
                name="reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason — the seller will see this"
                className="pill w-full px-4 py-2 text-[13px] outline-none placeholder:text-muted"
              />
              <FormButtons pending={removing} onCancel={() => setMode("idle")} label="Remove" danger />
              {removeState.error && <p className="text-[12px] text-urgency">{removeState.error}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function FormButtons({
  pending,
  onCancel,
  label,
  danger,
}: {
  pending: boolean;
  onCancel: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        disabled={pending}
        className={`flex-1 rounded-full px-3.5 py-2 text-[12.5px] font-bold disabled:opacity-60 ${
          danger ? "bg-urgency/90 text-base" : "bg-ink text-base"
        }`}
      >
        {pending ? "…" : `Confirm ${label.toLowerCase()}`}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-hairline px-3.5 py-2 text-[12.5px]"
      >
        Cancel
      </button>
    </div>
  );
}
