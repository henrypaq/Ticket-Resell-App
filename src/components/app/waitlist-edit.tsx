"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveWaitlistLeadAction, updateWaitlistLeadAction } from "@/domains/beta-quick/actions";
import type { QuickActionState, QuickWaitlistEntry } from "@/domains/beta-quick/shared";
import { QUICK_MAX_TICKETS } from "@/domains/beta-quick/shared";
import { BottomSheet } from "@/components/bottom-sheet";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import { COUNTRY_CODES } from "@/lib/country-codes";
import { formatPhoneNational } from "@/lib/phone-format";
import { ContactFields, DEFAULT_COUNTRY_ISO2, QuantityStepper, composeQuickPhone } from "./flow-fields";

function splitSavedPhone(e164: string | null | undefined): { iso2: string; national: string } {
  if (!e164) return { iso2: DEFAULT_COUNTRY_ISO2, national: "" };
  const digits = e164.replace(/\D/g, "");
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial) && digits.length > c.dial.length) {
      return { iso2: c.iso2, national: digits.slice(c.dial.length) };
    }
  }
  return { iso2: DEFAULT_COUNTRY_ISO2, national: digits };
}

function contactSummary(entry: QuickWaitlistEntry): string {
  if (entry.contactPhone) {
    const { iso2, national } = splitSavedPhone(entry.contactPhone);
    const dial = COUNTRY_CODES.find((c) => c.iso2 === iso2)?.dial ?? "1";
    return formatPhoneNational(national, dial);
  }
  if (entry.contactInstagram) return `@${entry.contactInstagram.replace(/^@+/, "")}`;
  return "No contact yet";
}

/**
 * "Your spot" on the waitlist page: a quiet summary row with an Edit button
 * that opens a sheet for ticket count, contact details, and leaving the line —
 * everything the old home-screen waitlist editor did.
 */
export function WaitlistSpotCard({ entry }: { entry: QuickWaitlistEntry }) {
  const [open, setOpen] = useState(false);
  const tickets = entry.quantity === 1 ? "1 ticket" : `${entry.quantity} tickets`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 text-left ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.06]"
      >
        <div className="min-w-0 flex-1">
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Your spot
          </p>
          <p className="mt-1 truncate text-[14px] text-ink">
            {tickets}
            <span className="text-muted"> · {contactSummary(entry)}</span>
          </p>
        </div>
        <span className="font-ui shrink-0 rounded-full bg-white/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-ink/85 transition-colors group-hover:bg-white/[0.12]">
          Edit
        </span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Edit your spot">
        {/* Remount per open so the form starts from the saved values. */}
        {open && <WaitlistEditForm entry={entry} onDone={() => setOpen(false)} />}
      </BottomSheet>
    </>
  );
}

function WaitlistEditForm({ entry, onDone }: { entry: QuickWaitlistEntry; onDone: () => void }) {
  const router = useRouter();
  const savedPhone = splitSavedPhone(entry.contactPhone);
  const savedQty = Math.min(QUICK_MAX_TICKETS, Math.max(1, entry.quantity));
  const [quantity, setQuantity] = useState(savedQty);
  const [phoneCountry, setPhoneCountry] = useState(savedPhone.iso2);
  const [phoneNational, setPhoneNational] = useState(savedPhone.national);
  const [instagram, setInstagram] = useState(entry.contactInstagram ?? "");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leavePending, startLeave] = useTransition();
  const [state, formAction, pending] = useActionState(
    updateWaitlistLeadAction,
    {} as QuickActionState,
  );

  const phone = composeQuickPhone(phoneCountry, phoneNational);
  const phoneOk = phoneNational.replace(/\D/g, "").length >= 7;
  const igNormalized = instagram.replace(/^@+/, "").trim();
  const igOk = igNormalized.length >= 2;
  const savedIg = (entry.contactInstagram ?? "").replace(/^@+/, "").trim();
  const dirty =
    quantity !== savedQty || phone !== (entry.contactPhone ?? "") || igNormalized !== savedIg;
  const canSave = (phoneOk || igOk) && dirty && !pending && !leavePending;

  useEffect(() => {
    if (state.ok) {
      onDone();
      router.refresh();
    }
  }, [state.ok, onDone, router]);

  function onLeave() {
    setLeaveError(null);
    startLeave(async () => {
      const result = await leaveWaitlistLeadAction(entry.leadId);
      if (result.error) {
        setLeaveError(result.error);
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-2">
      <form action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="leadId" value={entry.leadId} />
        <input type="hidden" name="quantity" value={quantity} />
        <input type="hidden" name="contactPhone" value={phone} />
        <input type="hidden" name="contactInstagram" value={igNormalized} />

        <div>
          <p className="font-ui mb-3 text-[13.5px] font-semibold tracking-tight text-ink">
            Tickets (max {QUICK_MAX_TICKETS})
          </p>
          <QuantityStepper value={quantity} onChange={setQuantity} max={QUICK_MAX_TICKETS} />
        </div>

        <div>
          <p className="font-ui mb-3 text-[13.5px] font-semibold tracking-tight text-ink">
            How we reach you
          </p>
          <ContactFields
            phoneCountry={phoneCountry}
            phoneNational={phoneNational}
            instagram={instagram}
            onPhoneCountry={setPhoneCountry}
            onPhoneNational={setPhoneNational}
            onInstagram={setInstagram}
            hintAbove
            hint="Enter at least one contact method."
          />
        </div>

        {(state.error || leaveError) && (
          <p role="alert" className="text-[13px] text-urgency">
            {state.error ?? leaveError}
          </p>
        )}

        <button type="submit" disabled={!canSave} className={`${BUTTON_CLASS} w-full`}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="border-t border-hairline pt-4">
        {confirmLeave ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted">Give up your place in line?</p>
            <div className="flex shrink-0 items-center gap-4 text-[13px] font-semibold">
              <button type="button" className="text-muted" onClick={() => setConfirmLeave(false)}>
                Stay
              </button>
              <button
                type="button"
                disabled={leavePending}
                className="text-urgency disabled:opacity-50"
                onClick={onLeave}
              >
                {leavePending ? "Leaving…" : "Leave"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            className="w-full text-center text-[13px] font-semibold text-muted transition-colors hover:text-urgency"
          >
            Leave this waitlist
          </button>
        )}
      </div>
    </div>
  );
}
