"use client";

import { useActionState, useState } from "react";
import { submitQuickEventRequestAction } from "@/domains/beta-quick/actions";
import type { QuickActionState } from "@/domains/beta-quick/shared";

/**
 * "Going somewhere else tonight?" — collapsed prompt that opens a request
 * form. Both apps had one of these (`/go` inline, `/member` as a whole view);
 * this is the single surviving version, writing to
 * `beta_member_event_requests` either way.
 */
export function EventRequestSection() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    submitQuickEventRequestAction,
    {} as QuickActionState,
  );

  return (
    <div className="relative">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07] active:scale-[0.99]"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-bold text-ink"
            >
              +
            </span>
            <span className="truncate text-[13.5px] font-medium text-ink">
              Going somewhere else?
            </span>
          </div>
          <span className="shrink-0 text-[12.5px] font-semibold text-[#ffe500]">
            Request an event →
          </span>
        </button>
      ) : (
        <div className="rounded-[18px] border border-white/12 bg-white/[0.04] p-4 sm:p-5">
          {state.ok ? (
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2 text-[#ffe500]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ffe500]/20 text-[14px] font-bold">
                  ✓
                </span>
                <p className="text-[15px] font-bold text-ink">Request received!</p>
              </div>
              <p className="text-[13.5px] leading-relaxed text-muted">
                {state.message ??
                  "We'll do our best to support this event ASAP so you can trade tickets safely."}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-3 rounded-[10px] bg-white/10 px-4 py-1.5 text-[13px] font-semibold text-ink hover:bg-white/15"
              >
                Done
              </button>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-bold text-ink">Request a new event</h3>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    Tell us what club or event you&apos;re heading to and we&apos;ll support it ASAP.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1 text-[13px] text-muted hover:text-ink"
                  aria-label="Close request form"
                >
                  ✕
                </button>
              </div>

              <div className="mt-1 flex flex-col gap-2.5">
                <div>
                  <label htmlFor="req-name" className="text-[12px] font-semibold text-muted">
                    Event or club name *
                  </label>
                  <input
                    id="req-name"
                    name="name"
                    required
                    placeholder="e.g. Stereo, Muzique, New City Gas…"
                    className="mt-1 w-full rounded-[12px] border border-white/15 bg-white/[0.05] px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted/60 focus:border-[#ffe500]/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="req-details" className="text-[12px] font-semibold text-muted">
                    Date or details (optional)
                  </label>
                  <input
                    id="req-details"
                    name="details"
                    placeholder="Tonight, date, or special DJ"
                    className="mt-1 w-full rounded-[12px] border border-white/15 bg-white/[0.05] px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted/60 focus:border-[#ffe500]/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="req-contact" className="text-[12px] font-semibold text-muted">
                    Your Instagram or phone (optional)
                  </label>
                  <input
                    id="req-contact"
                    name="contact"
                    placeholder="@handle or phone for when it's live"
                    className="mt-1 w-full rounded-[12px] border border-white/15 bg-white/[0.05] px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted/60 focus:border-[#ffe500]/60 focus:outline-none"
                  />
                </div>
              </div>

              {state.error && (
                <p role="alert" className="text-[12.5px] text-urgency">
                  {state.error}
                </p>
              )}

              <div className="mt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 text-[13px] font-semibold text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-[10px] bg-[#ffe500] px-4 py-2 text-[13px] font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Sending…" : "Request event"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
