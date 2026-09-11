"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitQuickSellAction, type QuickActionState } from "@/domains/beta-quick/actions";
import type { BetaEvent } from "@/lib/beta-events";
import { SELLER_TERMS_PATH } from "@/lib/compliance/seller-terms";
import { ArrowLeft } from "@/components/icons";
import { Field } from "@/components/beta-waitlist/field";
import { BUTTON_CLASS, FIELD_CLASS, FIELD_GROUP_CLASS } from "@/components/beta-waitlist/field-styles";
import { CountryCodeSelect } from "@/components/beta-waitlist/country-code-select";
import { countryByIso2 } from "@/lib/country-codes";
import { formatPhoneNational } from "@/lib/phone-format";
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

export function QuickSellFlow({ events }: { events: BetaEvent[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [eventSlug, setEventSlug] = useState(events[0]?.slug ?? "");
  const [quantity, setQuantity] = useState(1);
  const [paidEach, setPaidEach] = useState("");
  const [askEach, setAskEach] = useState("");
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY_ISO2);
  const [phoneNational, setPhoneNational] = useState("");
  const [instagram, setInstagram] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [ticketFileName, setTicketFileName] = useState<string | null>(null);
  const [etName, setEtName] = useState("");
  const [etEmail, setEtEmail] = useState("");
  const [etPhoneCountry, setEtPhoneCountry] = useState(DEFAULT_COUNTRY_ISO2);
  const [etPhoneNational, setEtPhoneNational] = useState("");
  const [terms, setTerms] = useState(false);
  const [state, formAction, pending] = useActionState(submitQuickSellAction, initial);

  if (state.ok) {
    return (
      <QuickShell>
        <p className="text-[17px] font-semibold text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-6 text-[30px] leading-tight">Got it — we&apos;ll post it</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          We&apos;ll reach out on WhatsApp or Instagram to confirm, then match you with a buyer.
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
  const paid = Number(paidEach);
  const ask = Number(askEach);
  const pricesOk =
    Number.isFinite(paid) &&
    Number.isFinite(ask) &&
    paid >= 0 &&
    ask >= 0 &&
    ask <= paid &&
    paidEach.trim() !== "" &&
    askEach.trim() !== "";
  const hasTicket = Boolean(ticketUrl.trim()) || Boolean(ticketFileName);
  const detailsReady = pricesOk && (phoneOk || igOk) && hasTicket;

  const etPhone = composeQuickPhone(etPhoneCountry, etPhoneNational);
  const etPhoneOk = etPhoneNational.replace(/\D/g, "").length >= 7;
  const etEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(etEmail.trim());
  const payoutReady = etName.trim().length > 0 && (etPhoneOk || etEmailOk) && terms;

  const etDial = countryByIso2(etPhoneCountry).dial;

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
        encType="multipart/form-data"
        onSubmit={(e) => {
          if (step < 2) e.preventDefault();
        }}
      >
        <input type="hidden" name="eventSlug" value={eventSlug} />
        <input type="hidden" name="quantity" value={quantity} />
        <input type="hidden" name="paidEach" value={paidEach} />
        <input type="hidden" name="askEach" value={askEach} />
        <input type="hidden" name="contactPhone" value={phone} />
        <input type="hidden" name="contactInstagram" value={instagram.replace(/^@+/, "").trim()} />
        <input type="hidden" name="ticketShareUrl" value={ticketUrl.trim()} />
        <input type="hidden" name="etransferName" value={etName.trim()} />
        <input type="hidden" name="etransferEmail" value={etEmail.trim()} />
        <input type="hidden" name="etransferPhone" value={etPhone} />
        {terms && <input type="hidden" name="sellerTermsAccepted" value="1" />}
        <input
          ref={fileRef}
          type="file"
          name="ticketImage"
          accept="image/jpeg,image/png,application/pdf"
          className="sr-only"
          onChange={(e) => setTicketFileName(e.target.files?.[0]?.name ?? null)}
        />

        {step === 0 && (
          <>
            <StepHeading eyebrow="Sell · 1 of 3" title="Which event?" />
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
            <StepHeading
              eyebrow="Sell · 2 of 3"
              title="Ticket details"
              hint="Ask price can't be higher than what you paid."
            />
            <div>
              <p className="mb-2 text-[13px] font-medium text-muted">How many?</p>
              <QuantityStepper value={quantity} onChange={setQuantity} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="You paid (each)" htmlFor="paidEach">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                    $
                  </span>
                  <input
                    id="paidEach"
                    inputMode="decimal"
                    placeholder="45"
                    value={paidEach}
                    onChange={(e) => setPaidEach(e.target.value.replace(/[^\d.]/g, ""))}
                    className={`${FIELD_CLASS} pl-8`}
                  />
                </div>
              </Field>
              <Field label="You want (each)" htmlFor="askEach">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                    $
                  </span>
                  <input
                    id="askEach"
                    inputMode="decimal"
                    placeholder="45"
                    value={askEach}
                    onChange={(e) => setAskEach(e.target.value.replace(/[^\d.]/g, ""))}
                    className={`${FIELD_CLASS} pl-8`}
                  />
                </div>
              </Field>
            </div>
            {paidEach && askEach && ask > paid && (
              <p className="text-[13px] text-urgency">Ask can&apos;t exceed what you paid.</p>
            )}
            <ContactFields
              phoneCountry={phoneCountry}
              phoneNational={phoneNational}
              instagram={instagram}
              onPhoneCountry={setPhoneCountry}
              onPhoneNational={setPhoneNational}
              onInstagram={setInstagram}
            />
            <Field label="Ticket share link (optional if you upload)" htmlFor="ticketUrl">
              <input
                id="ticketUrl"
                type="url"
                placeholder="https://…"
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
                className={FIELD_CLASS}
              />
            </Field>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-col gap-1 rounded-[14px] border border-dashed border-white/20 bg-white/[0.03] px-4 py-4 text-left"
            >
              <span className="text-[13px] font-medium text-muted">Or upload screenshot / PDF</span>
              <span className="text-[13.5px] text-ink">{ticketFileName ?? "Choose file…"}</span>
            </button>
            <button
              type="button"
              disabled={!detailsReady}
              onClick={() => setStep(2)}
              className={BUTTON_CLASS}
            >
              Continue
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <StepHeading
              eyebrow="Sell · 3 of 3"
              title="Interac e-Transfer"
              hint="Where we send payment when your ticket sells."
            />
            <Field label="Name on Interac" htmlFor="etName">
              <input
                id="etName"
                autoComplete="name"
                placeholder="Jane Doe"
                value={etName}
                onChange={(e) => setEtName(e.target.value)}
                className={FIELD_CLASS}
              />
            </Field>
            <Field label="Interac email" htmlFor="etEmail">
              <input
                id="etEmail"
                type="email"
                autoComplete="email"
                placeholder="jane@email.com"
                value={etEmail}
                onChange={(e) => setEtEmail(e.target.value)}
                className={FIELD_CLASS}
              />
            </Field>
            <Field label="Or Interac phone" htmlFor="etPhone">
              <div className={FIELD_GROUP_CLASS}>
                <CountryCodeSelect
                  value={etPhoneCountry}
                  onChange={setEtPhoneCountry}
                  className="border-r border-white/10"
                />
                <input
                  id="etPhone"
                  type="tel"
                  placeholder={etDial === "1" ? "(514) 555-0123" : "Phone number"}
                  value={formatPhoneNational(etPhoneNational.replace(/\D/g, ""), etDial)}
                  onChange={(e) =>
                    setEtPhoneNational(e.target.value.replace(/\D/g, "").slice(0, 15))
                  }
                  inputMode="tel"
                  className="min-w-0 flex-1 bg-transparent py-4 pl-3 pr-5 text-[16px] text-ink outline-none placeholder:text-muted/70"
                />
              </div>
            </Field>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#6ee1ff]"
              />
              <span className="text-[12.5px] leading-relaxed text-muted">
                I agree to the{" "}
                <Link
                  href={SELLER_TERMS_PATH}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ink underline decoration-dotted underline-offset-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  seller terms
                </Link>{" "}
                (no fakes, follow through on sales).
              </span>
            </label>
            {state.error && (
              <p role="alert" className="text-[13.5px] text-urgency">
                {state.error}
              </p>
            )}
            <button type="submit" disabled={!payoutReady || pending} className={BUTTON_CLASS}>
              {pending ? "Submitting…" : "Submit ticket"}
            </button>
          </>
        )}
      </form>
    </QuickShell>
  );
}
