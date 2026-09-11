"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitQuickBuyAction } from "@/domains/beta-quick/actions";
import type { QuickActionState } from "@/domains/beta-quick/shared";
import type { GoContactProfile } from "@/domains/beta-go/shared";
import type { BetaEvent } from "@/lib/beta-events";
import { ArrowLeft } from "@/components/icons";
import { BUTTON_CLASS } from "@/components/beta-waitlist/field-styles";
import { COUNTRY_CODES } from "@/lib/country-codes";
import { QuickShell } from "./shell";
import {
  ContactFields,
  DEFAULT_COUNTRY_ISO2,
  EventPicker,
  QuantityStepper,
  StepHeading,
  composeQuickPhone,
} from "./shared";

const initial: QuickActionState = {};
const LAST_STEP = 2;

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
}: {
  events: BetaEvent[];
  savedContact?: GoContactProfile | null;
  initialEventSlug?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [tapGuard, setTapGuard] = useState(false);
  const preset =
    initialEventSlug && events.some((e) => e.slug === initialEventSlug)
      ? initialEventSlug
      : (events[0]?.slug ?? "");
  const [eventSlug, setEventSlug] = useState(preset);
  const [quantity, setQuantity] = useState(1);
  const savedPhone = splitSavedPhone(savedContact?.contactPhone);
  const [phoneCountry, setPhoneCountry] = useState(savedPhone.iso2);
  const [phoneNational, setPhoneNational] = useState(savedPhone.national);
  const [instagram, setInstagram] = useState(savedContact?.contactInstagram ?? "");
  const [state, formAction, pending] = useActionState(submitQuickBuyAction, initial);

  useEffect(() => {
    if (state.ok) router.replace("/go/done?intent=buy");
  }, [state.ok, router]);

  if (state.ok) {
    return (
      <QuickShell>
        <p className="text-[17px] font-semibold text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-6 text-[30px] leading-tight">You&apos;re on the list</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">One moment…</p>
      </QuickShell>
    );
  }

  const phone = composeQuickPhone(phoneCountry, phoneNational);
  const phoneOk = phoneNational.replace(/\D/g, "").length >= 7;
  const igOk = instagram.replace(/^@+/, "").trim().length >= 2;
  const canContact = phoneOk || igOk;
  const isLast = step === LAST_STEP;

  const stepReady =
    (step === 0 && Boolean(eventSlug)) || step === 1 || (step === 2 && canContact);

  function goNext() {
    if (!stepReady || tapGuard || pending || isLast) return;
    setTapGuard(true);
    setTimeout(() => setTapGuard(false), 400);
    setStep((s) => s + 1);
  }

  return (
    <QuickShell>
      <button
        type="button"
        onClick={() => (step === 0 ? router.push("/go") : setStep((s) => s - 1))}
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

        <div key={step} className="flex flex-col gap-6">
          {step === 0 && (
            <>
              <StepHeading eyebrow="Need a ticket · 1 of 3" title="Which event?" />
              <EventPicker events={events} value={eventSlug} onChange={setEventSlug} />
            </>
          )}

          {step === 1 && (
            <>
              <StepHeading eyebrow="Need a ticket · 2 of 3" title="How many tickets?" />
              <QuantityStepper value={quantity} onChange={setQuantity} />
            </>
          )}

          {step === 2 && (
            <>
              <StepHeading
                eyebrow="Need a ticket · 3 of 3"
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
        </div>

        {state.error && (
          <p role="alert" className="mt-4 text-[13.5px] text-urgency">
            {state.error}
          </p>
        )}

        <button
          type={isLast ? "submit" : "button"}
          disabled={!stepReady || pending || tapGuard}
          onClick={() => {
            if (!isLast) goNext();
          }}
          className={`${BUTTON_CLASS} relative z-10 mt-6 w-full shrink-0`}
        >
          {isLast ? (pending ? "Joining…" : "Join waitlist") : "Continue"}
        </button>
      </form>
    </QuickShell>
  );
}
