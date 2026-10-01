"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveContactDraftAction, submitQuickBuyAction, loadBuyAvailabilityAction } from "@/domains/beta-quick/actions";
import { logBetaFlowStepAction } from "@/domains/beta-quick/funnel-log";
import type { QuickActionState } from "@/domains/beta-quick/shared";
import type { GoContactProfile } from "@/domains/beta-go/shared";
import type { BetaEvent } from "@/lib/beta-events";
import { formatBetaEventWhenShort, nextListedWeekdayForEvent } from "@/lib/beta-events";
import { BottomSheet } from "@/components/bottom-sheet";
import { Field } from "@/components/forms/field";
import { BUTTON_CLASS, FIELD_CLASS } from "@/components/forms/field-styles";
import { COUNTRY_CODES } from "@/lib/country-codes";
import { FlyerHero, JourneyProgress, JourneyScreen } from "./journey";
import {
  ContactFields,
  DEFAULT_COUNTRY_ISO2,
  EventPicker,
  QuantityStepper,
  StepHeading,
  composeQuickPhone,
} from "./flow-fields";
import { FixedPriceEventScreen } from "./fixed-price-event";
import { TicketAvailability } from "./event-pieces";
import { logFlowCompleted, useBetaFlowStepLog } from "./use-beta-flow-log";

const initial: QuickActionState = {};

const BUY_STEP_KEYS = ["event", "quantity", "contact", "transfer"] as const;
const BUY_FORM_ID = "quick-buy-form";

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
  const [transferOpen, setTransferOpen] = useState(false);
  const [state, formAction, pending] = useActionState(submitQuickBuyAction, initial);
  // Keyed by the slug it was fetched for, so switching events can't show the
  // previous night's numbers and the stale value needs no reset effect.
  const [availabilityFor, setAvailabilityFor] = useState<{
    slug: string;
    data: {
      availableUnits: number;
      demandAhead: number;
      canCheckoutNow: boolean;
      averagePriceEach: number | null;
    };
  } | null>(null);
  const availability = availabilityFor?.slug === eventSlug ? availabilityFor.data : null;

  useEffect(() => {
    if (!state.ok) return;
    void logBetaFlowStepAction({ intent: "buy", step: "submit", eventSlug });
    logFlowCompleted({ intent: "buy", eventSlug });
    if (state.offerId) {
      router.replace(`/offer/${state.offerId}`);
      return;
    }
    // Hard navigation so the buyer cookie from the server action is on the
    // next request (same race the fixed-price flow hit with a soft replace).
    const params = new URLSearchParams({ event: eventSlug, joined: "1" });
    if (state.leadId) params.set("lead", state.leadId);
    window.location.assign(state.leadId ? `/queue?${params.toString()}` : "/done?intent=buy");
  }, [state.ok, state.offerId, state.leadId, router, eventSlug]);

  useEffect(() => {
    if (!eventSlug) return;
    let cancelled = false;
    void loadBuyAvailabilityAction(eventSlug, quantity).then((result) => {
      if (!cancelled && result) setAvailabilityFor({ slug: eventSlug, data: result });
    });
    return () => {
      cancelled = true;
    };
  }, [eventSlug, quantity]);

  const showFixedPrice =
    lockedEvent?.fixedPriceEach != null && (eventLocked || step > 0);

  useBetaFlowStepLog({
    intent: "buy",
    stepKey: showFixedPrice
      ? "fixed_price"
      : transferOpen
        ? "transfer"
        : (BUY_STEP_KEYS[Math.min(step, BUY_STEP_KEYS.length - 1)] ?? "event"),
    eventSlug,
    enabled: !state.ok && !showFixedPrice,
  });

  if (showFixedPrice && lockedEvent) {
    return (
      <FixedPriceEventScreen
        event={lockedEvent}
        day={nextListedWeekdayForEvent(lockedEvent)}
        savedContact={savedContact}
        backHref={backHref}
        onBack={
          eventLocked
            ? undefined
            : () => {
                setStep(0);
              }
        }
      />
    );
  }

  // While redirecting to /done, keep the form — no interim success page.
  const redirecting = Boolean(state.ok);

  const isCafeCampus = eventSlug === "cafe-campus";
  // Café Campus asks for the transfer recipient in a sheet over the last step,
  // like the fixed-price checkout, rather than as a page of its own.
  const lastStep = 2;
  const totalSteps = lastStep - firstStep + 1;
  const phone = composeQuickPhone(phoneCountry, phoneNational);
  const phoneOk = phoneNational.replace(/\D/g, "").length >= 7;
  const igOk = instagram.replace(/^@+/, "").trim().length >= 2;
  const canContact = phoneOk || igOk;
  const transferOk =
    transferFirstName.trim().length >= 1 &&
    transferLastName.trim().length >= 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(transferEmail.trim());
  const isLast = step >= lastStep;
  const stepIndex = Math.min(step, lastStep) - firstStep + 1;
  const stepLabel = `Step ${stepIndex} of ${totalSteps}`;
  const whenLine = lockedEvent
    ? `${formatBetaEventWhenShort(nextListedWeekdayForEvent(lockedEvent))} · ${lockedEvent.venue}`
    : null;

  const stepReady =
    (step === 0 && Boolean(eventSlug)) || step === 1 || (step >= 2 && canContact);
  const submitLabel =
    pending || redirecting
      ? availability?.canCheckoutNow
        ? "Getting ticket…"
        : "Joining…"
      : availability?.canCheckoutNow
        ? "Get ticket"
        : "Join waitlist";

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

  const errorLine = state.error && (
    <p role="alert" className="text-center text-[13.5px] text-urgency">
      {state.error}
    </p>
  );

  return (
    <JourneyScreen
      footer={
        <>
          {!transferOpen && errorLine}
          {isLast && isCafeCampus ? (
            <button
              type="button"
              disabled={!stepReady || pending || redirecting}
              onClick={() => {
                void saveContactDraftAction({ phone, instagram, name: "", email: "" });
                setTransferOpen(true);
              }}
              className={`${BUTTON_CLASS} w-full`}
            >
              Continue
            </button>
          ) : (
            <button
              type={isLast ? "submit" : "button"}
              form={isLast ? BUY_FORM_ID : undefined}
              disabled={!stepReady || pending || tapGuard || redirecting}
              onClick={() => {
                if (!isLast) goNext();
              }}
              className={`${BUTTON_CLASS} w-full`}
            >
              {isLast ? submitLabel : "Continue"}
            </button>
          )}
        </>
      }
    >
      <FlyerHero
        flyerUrl={lockedEvent?.flyerUrl}
        onBack={onBack}
        eyebrow="Need a ticket"
        title={lockedEvent?.name ?? "Find a ticket"}
        subtitle={whenLine}
        size="sm"
      />

      <form
        id={BUY_FORM_ID}
        action={formAction}
        className="relative flex flex-col px-5 pb-8 pt-4 sm:px-6"
        onSubmit={(e) => {
          if (!isLast) {
            e.preventDefault();
            goNext();
            return;
          }
          if (isCafeCampus && !transferOk) e.preventDefault();
        }}
      >
        <input type="hidden" name="eventSlug" value={eventSlug} />
        <input type="hidden" name="quantity" value={quantity} />
        <input type="hidden" name="contactPhone" value={phone} />
        <input type="hidden" name="contactInstagram" value={instagram.replace(/^@+/, "").trim()} />
        <input type="hidden" name="transferFirstName" value={transferFirstName.trim()} />
        <input type="hidden" name="transferLastName" value={transferLastName.trim()} />
        <input type="hidden" name="transferEmail" value={transferEmail.trim()} />
        <JourneyProgress current={stepIndex} total={totalSteps} />

        <div key={step} className="mt-6 flex flex-col gap-6">
          {step === 0 && (
            <>
              <StepHeading eyebrow={stepLabel} title="Choose an event" />
              <EventPicker events={events} value={eventSlug} onChange={setEventSlug} />
            </>
          )}

          {step === 1 && (
            <>
              <StepHeading eyebrow={stepLabel} title="How many tickets?" />
              <QuantityStepper value={quantity} onChange={setQuantity} max={2} />
              <TicketAvailability
                units={availability?.availableUnits ?? null}
                averagePrice={availability?.averagePriceEach ?? null}
              />
            </>
          )}

          {step >= 2 && (
            <>
              <StepHeading eyebrow={stepLabel} title="How should we reach you?" />
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
        </div>
      </form>

      <BottomSheet
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Ticket transfer"
      >
        <div className="flex flex-col gap-4 px-1 pb-2">
          <p className="text-[14px] leading-relaxed text-muted">
            Enter the name and email exactly as they should appear on the ticket. This is where
            we&apos;ll send your Café Campus ticket once payment clears.
          </p>
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
          {errorLine}
          <button
            type="submit"
            form={BUY_FORM_ID}
            disabled={!transferOk || pending || redirecting}
            className={`${BUTTON_CLASS} w-full`}
          >
            {submitLabel}
          </button>
        </div>
      </BottomSheet>
    </JourneyScreen>
  );
}
