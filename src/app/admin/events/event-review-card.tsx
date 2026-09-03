"use client";

import { useActionState, useState } from "react";
import { approveEventAction, rejectEventAction, type AdminFormState } from "@/app/admin/actions";

const PRICE_SOURCE_LABEL: Record<string, string> = {
  platform_parsed: "Parsed from source link",
  admin_verified: "Admin verified",
  user_submitted_unverified: "User-entered, unverified",
  producer_confirmed: "Producer confirmed",
};

const initial: AdminFormState = {};

export function EventReviewCard({
  event,
  formattedPrice,
}: {
  event: {
    id: string;
    name: string;
    venue: string;
    city: string;
    startsAt: string;
    originalPrice: number;
    priceSource: string;
    sourceUrl: string | null;
    sourcePlatform: string;
    status: string;
  };
  formattedPrice: string;
}) {
  const [approveState, approveAction, approving] = useActionState(approveEventAction, initial);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectEventAction, initial);
  const [note, setNote] = useState("");
  const [rejecting_, setRejecting] = useState(false);

  const done = approveState.message || rejectState.message;

  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold">{event.name}</h3>
          <p className="mt-1 text-[13px] text-muted">
            {event.venue}, {event.city} ·{" "}
            {new Date(event.startsAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <span className="pill-quiet shrink-0 px-2.5 py-1 text-[11px] uppercase tracking-wide">
          {event.status}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-muted">Original price</dt>
        <dd className="text-right font-semibold">{formattedPrice}</dd>
        <dt className="text-muted">Price source</dt>
        <dd className="text-right">{PRICE_SOURCE_LABEL[event.priceSource] ?? event.priceSource}</dd>
        <dt className="text-muted">Platform</dt>
        <dd className="text-right capitalize">{event.sourcePlatform}</dd>
      </dl>

      {event.sourceUrl && (
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 block truncate text-[12.5px] text-muted underline underline-offset-2"
        >
          {event.sourceUrl}
        </a>
      )}

      {done ? (
        <p className="mt-4 rounded-xl border border-hairline px-3 py-2 text-[13px] text-muted">
          {done}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rejecting_ ? (
            <form action={rejectAction} className="space-y-2">
              <input type="hidden" name="eventId" value={event.id} />
              <textarea
                name="note"
                required
                placeholder="Why is this rejected? The submitter isn't shown this yet, but it's on the record."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="pill w-full px-4 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-muted"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={rejecting}
                  className="flex-1 rounded-full bg-urgency/90 px-4 py-2.5 text-[13.5px] font-bold text-base disabled:opacity-60"
                >
                  {rejecting ? "…" : "Confirm reject"}
                </button>
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  className="rounded-full border border-hairline px-4 py-2.5 text-[13.5px]"
                >
                  Cancel
                </button>
              </div>
              {rejectState.error && <p className="text-[12.5px] text-urgency">{rejectState.error}</p>}
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <form action={approveAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="resaleEnabled" value="true" />
                <button
                  type="submit"
                  disabled={approving}
                  className="rounded-full bg-ink px-4 py-2.5 text-[13.5px] font-bold text-base disabled:opacity-60"
                >
                  {approving ? "…" : "Approve for resale"}
                </button>
              </form>
              <form action={approveAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="resaleEnabled" value="false" />
                <button
                  type="submit"
                  disabled={approving}
                  className="rounded-full border border-hairline px-4 py-2.5 text-[13.5px] font-semibold disabled:opacity-60"
                >
                  Discoverable only
                </button>
              </form>
              <button
                type="button"
                onClick={() => setRejecting(true)}
                className="rounded-full border border-hairline px-4 py-2.5 text-[13.5px] font-semibold text-muted"
              >
                Reject
              </button>
              {approveState.error && <p className="w-full text-[12.5px] text-urgency">{approveState.error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
