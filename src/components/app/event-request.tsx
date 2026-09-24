"use client";

import { useActionState, useState } from "react";
import { submitQuickEventRequestAction } from "@/domains/beta-quick/actions";
import type { QuickActionState } from "@/domains/beta-quick/shared";
import { BUTTON_CLASS, FIELD_CLASS } from "@/components/forms/field-styles";

/**
 * "Going somewhere else tonight?" — collapsed prompt that opens a request
 * form. Both apps had one of these (`/go` inline, `/member` as a whole view);
 * this is the single surviving version, writing to
 * `beta_member_event_requests` either way.
 *
 * Visually secondary on purpose: quiet solid surface — so it never competes
 * with Need a ticket / Have a ticket.
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
          className="font-ui flex w-full items-center justify-between gap-3 rounded-[14px] border-0 bg-card px-4 py-3.5 text-left transition-colors hover:bg-[#1c1c20] active:bg-[#1c1c20]"
        >
          <span className="truncate text-[13.5px] text-muted">Going somewhere else?</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold tracking-tight text-ink">
            Request an event
            <span aria-hidden>→</span>
          </span>
        </button>
      ) : (
        <div className="rounded-[14px] border-0 bg-card p-4">
          {state.ok ? (
            <div className="flex flex-col gap-2">
              <p className="font-ui text-[14px] font-semibold tracking-tight text-ink">
                Request received
              </p>
              <p className="text-[13px] leading-relaxed text-muted">
                {state.message ??
                  "We'll do our best to support this event ASAP so you can trade tickets safely."}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-ui mt-2 self-start text-[13px] font-medium text-muted underline decoration-white/20 underline-offset-4 hover:text-ink"
              >
                Done
              </button>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-ui text-[14px] font-semibold tracking-tight text-ink">
                  Request a new event
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[13px] text-muted hover:text-ink"
                  aria-label="Close request form"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                <div>
                  <label htmlFor="req-name" className="font-ui text-[12px] font-medium text-muted">
                    Event or club name
                  </label>
                  <input
                    id="req-name"
                    name="name"
                    required
                    placeholder="e.g. Stereo, Muzique…"
                    className={`mt-1 ${FIELD_CLASS} !rounded-[10px] !px-3 !py-2.5 !text-[14px]`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="req-details"
                    className="font-ui text-[12px] font-medium text-muted"
                  >
                    Date or details (optional)
                  </label>
                  <input
                    id="req-details"
                    name="details"
                    placeholder="Tonight, date, or DJ"
                    className={`mt-1 ${FIELD_CLASS} !rounded-[10px] !px-3 !py-2.5 !text-[14px]`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="req-contact"
                    className="font-ui text-[12px] font-medium text-muted"
                  >
                    Instagram or phone (optional)
                  </label>
                  <input
                    id="req-contact"
                    name="contact"
                    placeholder="@handle or phone"
                    className={`mt-1 ${FIELD_CLASS} !rounded-[10px] !px-3 !py-2.5 !text-[14px]`}
                  />
                </div>
              </div>

              {state.error && (
                <p role="alert" className="text-[12.5px] text-urgency">
                  {state.error}
                </p>
              )}

              <div className="mt-1 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="font-ui text-[13px] font-semibold text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className={`${BUTTON_CLASS} !min-h-[40px] !rounded-[10px] !px-4 !py-2 !text-[13px]`}
                >
                  {pending ? "Sending…" : "Send request"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
