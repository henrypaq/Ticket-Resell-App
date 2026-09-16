"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveContactDraftAction, submitQuickBuyAction } from "@/domains/beta-quick/actions";
import { logBetaFlowStepAction } from "@/domains/beta-quick/funnel-log";
import type { QuickActionState } from "@/domains/beta-quick/shared";
import type { GoContactProfile } from "@/domains/beta-go/shared";
import type { BetaEvent } from "@/lib/beta-events";
import { ArrowLeft } from "@/components/icons";
import { Field } from "@/components/forms/field";
import { BUTTON_CLASS, FIELD_CLASS } from "@/components/forms/field-styles";
import { COUNTRY_CODES } from "@/lib/country-codes";
import { AppFlowShell } from "./shell";
import {
  ContactFields,
  DEFAULT_COUNTRY_ISO2,
  EventPicker,
  QuantityStepper,
  StepHeading,
  composeQuickPhone,
} from "./flow-fields";
import { logFlowCompleted, useBetaFlowStepLog } from "./use-beta-flow-log";

const initial: QuickActionState = {};

const BUY_STEP_KEYS = ["event", "quantity", "contact", "transfer"] as const;

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

export function QuickBuyFlow({
  events,
  savedContact,
  initialEventSlug,
  backHref = "/",
}: {
  events: BetaEvent[];
  savedContact?: GoContactProfile | null;
  initialEventSlug?: string | null;
  /** Where Back goes from the first step. */
  backHref?: string;
}) {
  const router = useRouter();
  // Deep link from an event card (?event=) locks the venue — skip the picker.
  const eventLocked = Boolean(initialEventSlug?.trim());
  const firstStep = eventLocked ? 1 : 0;
  const [step, setStep] = useState(firstStep);
  const [tapGuard, setTapGuard] = useState(false);
  const preset = eventLocked
    ? initialEventSlug!.trim()
    : (events[0]?.slug ?? "");
  const [eventSlug, setEventSlug] = useState(preset);
  const lockedEvent = events.find((e) => e.slug === eventSlug) ?? null;
  const [quantity, setQuantity] = useState(1);
  const savedPhone = splitSavedPhone(savedContact?.contactPhone);
  const [phoneCountry, setPhoneCountry] = useState(savedPhone.iso2);
  const [phoneNational, setPhoneNational] = useState(savedPhone.national);
  const [instagram, setInstagram] = useState(savedContact?.contactInstagram ?? "");
  const [transferFirstName, setTransferFirstName] = useState("");
  const [transferLastName, setTransferLastName] = useState("");
  const [transferEmail, setTransferEmail] = useState("");
  const [maxPriceEach, setMaxPriceEach] = useState("");
  const [state, formAction, pending] = useActionState(submitQuickBuyAction, initial);

  useEffect(() => {
    if (!state.ok) return;
    void logBetaFlowStepAction({ intent: "buy", step: "submit", eventSlug });
    logFlowCompleted({ intent: "buy", eventSlug });
    if (state.offerId) router.replace(`/offer/${state.offerId}`);
    else router.replace("/done?intent=buy");
  }, [state.ok, state.offerId, router, eventSlug]);

  // While redirecting to /done, keep the form — no interim success page.
  const redirecting = Boolean(state.ok);

  const isCafeCampus = eventSlug === "cafe-campus";
  // Café Campus adds a transfer-recipient step after contact.
  const lastStep = isCafeCampus ? 3 : 2;
  const totalSteps = lastStep - firstStep + 1;
  const phone = composeQuickPhone(phoneCountry, phoneNational);
  const phoneOk = phoneNational.replace(/\D/g, "").length >= 7;
  const igOk = instagram.replace(/^@+/, "").trim().length >= 2;
  const canContact = phoneOk || igOk;
  const transferOk =
    transferFirstName.trim().length >= 1 &&
    transferLastName.trim().length >= 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(transferEmail.trim());
  // Café Campus adds a transfer step; clamp if the event switch shortens the flow.
  const safeStep = Math.min(step, lastStep);
  if (safeStep !== step) {
    setStep(safeStep);
  }
  const isLast = safeStep === lastStep;
  const stepIndex = safeStep - firstStep + 1;
  const stepLabel = `Need a ticket · ${stepIndex} of ${totalSteps}`;
  const stepKey = BUY_STEP_KEYS[Math.min(safeStep, BUY_STEP_KEYS.length - 1)] ?? "event";

  useBetaFlowStepLog({
    intent: "buy",
    stepKey,
    eventSlug,
    enabled: !redirecting,
  });

  const stepReady =
    (safeStep === 0 && Boolean(eventSlug)) ||
    safeStep === 1 ||
    (safeStep === 2 && canContact) ||
    (safeStep === 3 && transferOk);

  function goNext() {
    if (!stepReady || tapGuard || pending || isLast || redirecting) return;
    // Stash what they've typed so far. Someone who gets this far and then
    // closes the tab should not be asked for it all again next visit.
    void saveContactDraftAction({
      phone,
      instagram,
      name: [transferFirstName, transferLastName].filter(Boolean).join(" "),
      email: transferEmail,
    });
    setTapGuard(true);
    setTimeout(() => setTapGuard(false), 400);
    setStep((s) => s + 1);
  }

  function onBack() {
    if (step <= firstStep) {
      router.push(backHref);
      return;
    }
    setStep((s) => s - 1);
  }

  return (
    <AppFlowShell>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 self-start text-[13.5px] font-semibold text-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <form
        action={formAction}
        className="relative mt-6 flex flex-col"
        onSubmit={(e) => {
          if (!isLast) {
            e.preventDefault();
            goNext();
          }
        }}
      >
        <input type="hidden" name="eventSlug" value={eventSlug} />
        <input type="hidden" name="quantity" value={quantity} />
        <input type="hidden" name="contactPhone" value={phone} />
        <input type="hidden" name="contactInstagram" value={instagram.replace(/^@+/, "").trim()} />
        <input type="hidden" name="transferFirstName" value={transferFirstName.trim()} />
        <input type="hidden" name="transferLastName" value={transferLastName.trim()} />
        <input type="hidden" name="transferEmail" value={transferEmail.trim()} />
        {maxPriceEach.trim() !== "" && (
          <input type="hidden" name="maxPriceEach" value={maxPriceEach.trim()} />
        )}

        <div key={safeStep} className="flex flex-col gap-6">
          {safeStep === 0 && (
            <>
              <StepHeading eyebrow={stepLabel} title="Which event?" />
              <EventPicker events={events} value={eventSlug} onChange={setEventSlug} />
            </>
          )}

          {safeStep === 1 && (
            <>
              <StepHeading eyebrow={stepLabel} title="How many tickets?" />
              {eventLocked && lockedEvent && (
                <p className="text-[13.5px] text-muted">
                  For <span className="font-semibold text-ink">{lockedEvent.name}</span>
                </p>
              )}
              <QuantityStepper value={quantity} onChange={setQuantity} max={2} />
              <Field label="Max you'll pay each (optional)" htmlFor="maxPriceEach">
                <input
                  id="maxPriceEach"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 40"
                  value={maxPriceEach}
                  onChange={(e) => setMaxPriceEach(e.target.value)}
                  className={FIELD_CLASS}
                />
              </Field>
              <p className="text-[12.5px] text-muted">
                We&apos;ll only hold tickets at or under this price. Leave blank for no limit.
              </p>
            </>
          )}

          {safeStep === 2 && (
            <>
              <StepHeading
                eyebrow={stepLabel}
                title="How do we reach you?"
                hint="We'll message you when a ticket is ready."
              />
              <ContactFields
                phoneCountry={phoneCountry}
                phoneNational={phoneNational}
                instagram={instagram}
                onPhoneCountry={setPhoneCountry}
                onPhoneNational={setPhoneNational}
                onInstagram={setInstagram}
              />
            </>
          )}

          {safeStep === 3 && isCafeCampus && (
            <>
              <StepHeading
                eyebrow={stepLabel}
                title="Ticket transfer details"
                hint="Café Campus transfers the ticket into this name and email — use them exactly as they should appear."
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" htmlFor="transferFirstName">
                  <input
                    id="transferFirstName"
                    type="text"
                    autoComplete="given-name"
                    placeholder="Alex"
                    value={transferFirstName}
                    onChange={(e) => setTransferFirstName(e.target.value)}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label="Last name" htmlFor="transferLastName">
                  <input
                    id="transferLastName"
                    type="text"
                    autoComplete="family-name"
                    placeholder="Nguyen"
                    value={transferLastName}
                    onChange={(e) => setTransferLastName(e.target.value)}
                    className={FIELD_CLASS}
                  />
                </Field>
              </div>
              <Field label="Email" htmlFor="transferEmail">
                <input
                  id="transferEmail"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@mail.mcgill.ca"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  className={FIELD_CLASS}
                />
              </Field>
            </>
          )}
        </div>

        {state.error && (
          <p role="alert" className="mt-4 text-[13.5px] text-urgency">
            {state.error}
          </p>
        )}

        <button
          type={isLast ? "submit" : "button"}
          disabled={!stepReady || pending || tapGuard || redirecting}
          onClick={() => {
            if (!isLast) goNext();
          }}
          className={`${BUTTON_CLASS} relative z-10 mt-6 w-full shrink-0`}
        >
          {isLast
            ? pending || redirecting
              ? "Joining…"
              : "Join waitlist"
            : "Continue"}
        </button>
      </form>
    </AppFlowShell>
  );
}
