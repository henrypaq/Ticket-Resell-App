"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitQuickSellAction } from "@/domains/beta-quick/actions";
import type { QuickActionState } from "@/domains/beta-quick/shared";
import type { GoContactProfile } from "@/domains/beta-go/shared";
import type { BetaEvent } from "@/lib/beta-events";
import { SELLER_TERMS_PATH } from "@/lib/compliance/seller-terms";
import { ArrowLeft } from "@/components/icons";
import { Field } from "@/components/beta-waitlist/field";
import { BUTTON_CLASS, FIELD_CLASS, FIELD_GROUP_CLASS } from "@/components/beta-waitlist/field-styles";
import { CountryCodeSelect } from "@/components/beta-waitlist/country-code-select";
import { countryByIso2, COUNTRY_CODES } from "@/lib/country-codes";
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
const LAST_STEP = 5;

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

export function QuickSellFlow({
  events,
  savedContact,
  initialEventSlug,
}: {
  events: BetaEvent[];
  savedContact?: GoContactProfile | null;
  initialEventSlug?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const preset =
    initialEventSlug && events.some((e) => e.slug === initialEventSlug)
      ? initialEventSlug
      : (events[0]?.slug ?? "");
  const [eventSlug, setEventSlug] = useState(preset);
  const [quantity, setQuantity] = useState(1);
  const [paidEach, setPaidEach] = useState("");
  const [askEach, setAskEach] = useState("");
  const savedPhone = splitSavedPhone(savedContact?.contactPhone);
  const [phoneCountry, setPhoneCountry] = useState(savedPhone.iso2);
  const [phoneNational, setPhoneNational] = useState(savedPhone.national);
  const [instagram, setInstagram] = useState(savedContact?.contactInstagram ?? "");
  const [ticketUrl, setTicketUrl] = useState("");
  const [ticketFileName, setTicketFileName] = useState<string | null>(null);
  const ticketFileRef = useRef<File | null>(null);
  const [etName, setEtName] = useState(savedContact?.etransferName ?? "");
  const [etEmail, setEtEmail] = useState(savedContact?.etransferEmail ?? "");
  const savedEtPhone = splitSavedPhone(savedContact?.etransferPhone);
  const [etPhoneCountry, setEtPhoneCountry] = useState(savedEtPhone.iso2);
  const [etPhoneNational, setEtPhoneNational] = useState(savedEtPhone.national);
  const [terms, setTerms] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: QuickActionState, fd: FormData) => {
      const existing = fd.get("ticketImage");
      const kept = ticketFileRef.current;
      if (kept && (!(existing instanceof File) || existing.size === 0)) {
        fd.set("ticketImage", kept);
      }
      return submitQuickSellAction(prev, fd);
    },
    initial,
  );

  useEffect(() => {
    if (state.ok) router.replace("/go/done?intent=sell");
  }, [state.ok, router]);

  if (state.ok) {
    return (
      <QuickShell>
        <p className="text-[17px] font-semibold text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-6 text-[30px] leading-tight">Got it — we&apos;ll post it</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">One moment…</p>
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
    paidEach.trim() !== "" &&
    askEach.trim() !== "";
  const hasTicket = Boolean(ticketUrl.trim()) || Boolean(ticketFileName);
  const ticketStepReady = hasTicket && terms;

  const etPhone = composeQuickPhone(etPhoneCountry, etPhoneNational);
  const etPhoneOk = etPhoneNational.replace(/\D/g, "").length >= 7;
  const etEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(etEmail.trim());
  const payoutReady = etName.trim().length > 0 && (etPhoneOk || etEmailOk);

  const etDial = countryByIso2(etPhoneCountry).dial;
  const stepLabel = `Sell · ${step + 1} of ${LAST_STEP + 1}`;

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
          if (step < LAST_STEP) e.preventDefault();
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
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            ticketFileRef.current = file;
            setTicketFileName(file?.name ?? null);
          }}
        />

        {step === 0 && (
          <>
            <StepHeading eyebrow={stepLabel} title="Which event?" />
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
            <StepHeading eyebrow={stepLabel} title="How many tickets?" />
            <QuantityStepper value={quantity} onChange={setQuantity} />
            <button type="button" onClick={() => setStep(2)} className={BUTTON_CLASS}>
              Continue
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <StepHeading
              eyebrow={stepLabel}
              title="Pricing"
            />
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
            <button
              type="button"
              disabled={!pricesOk}
              onClick={() => setStep(3)}
              className={BUTTON_CLASS}
            >
              Continue
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <StepHeading
              eyebrow={stepLabel}
              title="How do we reach you?"
            />
            <ContactFields
              phoneCountry={phoneCountry}
              phoneNational={phoneNational}
              instagram={instagram}
              onPhoneCountry={setPhoneCountry}
              onPhoneNational={setPhoneNational}
              onInstagram={setInstagram}
              hintAbove
              hint="Enter one of the contacts below. We'll message you there."
            />
            <button
              type="button"
              disabled={!(phoneOk || igOk)}
              onClick={() => setStep(4)}
              className={BUTTON_CLASS}
            >
              Continue
            </button>
          </>
        )}

        {step === 4 && (
          <>
            <StepHeading
              eyebrow={stepLabel}
              title="Prove the ticket"
              hint="Upload a clear screenshot or PDF, or paste the official share link."
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-white/25 bg-white/[0.05] px-5 py-8 text-center transition-colors hover:border-[#ffe500]/40 hover:bg-white/[0.08]"
            >
              <span className="text-[15px] font-semibold text-ink">
                {ticketFileName ? "Replace file" : "Upload ticket screenshot / PDF"}
              </span>
              <span className="max-w-[16rem] text-[13px] leading-relaxed text-muted">
                {ticketFileName
                  ? ticketFileName
                  : "JPEG, PNG, or PDF · up to 8MB · make sure the QR / barcode is readable"}
              </span>
            </button>
            <Field label="Or paste a share link" htmlFor="ticketUrl">
              <input
                id="ticketUrl"
                type="url"
                placeholder="https://…"
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
                className={FIELD_CLASS}
              />
            </Field>
            {!hasTicket && (
              <p className="text-[13px] text-muted">Add a file or a link to continue.</p>
            )}
            <label className="flex cursor-pointer items-start gap-3 rounded-[16px] border border-hairline bg-white/[0.04] px-4 py-4">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#6ee1ff]"
              />
              <span className="text-[13px] leading-relaxed text-muted">
                I confirm this is a real, unused ticket I own, the file/link is accurate and
                unedited, and I agree to the{" "}
                <Link
                  href={SELLER_TERMS_PATH}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ink underline decoration-dotted underline-offset-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  seller terms
                </Link>
                . Make sure your ticket is for the correct date before posting.
              </span>
            </label>
            <button
              type="button"
              disabled={!ticketStepReady}
              onClick={() => setStep(5)}
              className={BUTTON_CLASS}
            >
              Continue
            </button>
          </>
        )}

        {step === 5 && (
          <>
            <StepHeading
              eyebrow={stepLabel}
              title="Interac e-Transfer"
              hint="Where we send the payment when your ticket sells."
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
