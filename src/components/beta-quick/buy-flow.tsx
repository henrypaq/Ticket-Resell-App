"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitQuickBuyAction, type QuickActionState } from "@/domains/beta-quick/actions";
import type { BetaEvent } from "@/lib/beta-events";
import { ArrowLeft } from "@/components/icons";
import { BUTTON_CLASS } from "@/components/beta-waitlist/field-styles";
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

export function QuickBuyFlow({ events }: { events: BetaEvent[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [eventSlug, setEventSlug] = useState(events[0]?.slug ?? "");
  const [quantity, setQuantity] = useState(1);
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY_ISO2);
  const [phoneNational, setPhoneNational] = useState("");
  const [instagram, setInstagram] = useState("");
  const [state, formAction, pending] = useActionState(submitQuickBuyAction, initial);

  if (state.ok) {
    return (
      <QuickShell>
        <p className="text-[17px] font-semibold text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-6 text-[30px] leading-tight">You&apos;re on the list</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          We&apos;ll message you as soon as a ticket opens up for that event.
        </p>
        <Link href="/go" className={`${BUTTON_CLASS} mt-8`}>
          Back to tonight
        </Link>
      </QuickShell>
    );
  }

  const phone = composeQuickPhone(phoneCountry, phoneNational);
  const phoneOk = phoneNational.replace(/\D/g, "").length >= 7;
  const igOk = instagram.replace(/^@+/, "").trim().length >= 2;
  const canContact = phoneOk || igOk;

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
        className="relative mt-6 flex flex-col gap-6"
        onSubmit={(e) => {
          if (step < 2) {
            e.preventDefault();
            setStep((s) => s + 1);
          }
        }}
      >
        <input type="hidden" name="eventSlug" value={eventSlug} />
        <input type="hidden" name="quantity" value={quantity} />
        <input type="hidden" name="contactPhone" value={phone} />
        <input type="hidden" name="contactInstagram" value={instagram.replace(/^@+/, "").trim()} />

        {step === 0 && (
          <>
            <StepHeading eyebrow="Need a ticket · 1 of 3" title="Which event?" />
            <EventPicker events={events} value={eventSlug} onChange={setEventSlug} />
            <button
              type="button"
              disabled={!eventSlug}
              onClick={() => setStep(1)}
              className={BUTTON_CLASS}
            >
              Continue
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <StepHeading eyebrow="Need a ticket · 2 of 3" title="How many tickets?" />
            <QuantityStepper value={quantity} onChange={setQuantity} />
            <button type="button" onClick={() => setStep(2)} className={BUTTON_CLASS}>
              Continue
            </button>
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
            {state.error && (
              <p role="alert" className="text-[13.5px] text-urgency">
                {state.error}
              </p>
            )}
            <button type="submit" disabled={!canContact || pending} className={BUTTON_CLASS}>
              {pending ? "Joining…" : "Join waitlist"}
            </button>
          </>
        )}
      </form>
    </QuickShell>
  );
}
