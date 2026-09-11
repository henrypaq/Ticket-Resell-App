"use client";

import { useActionState, useEffect, useState } from "react";
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
  TrustNote,
  composeQuickPhone,
} from "./shared";
import { TicketUploadZone, type TicketFile } from "./ticket-upload";
import { GO_TRUST } from "@/lib/beta-trust";
import { currentBetaWeekday } from "@/lib/beta-events";

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
}: {
  events: BetaEvent[];
  savedContact?: GoContactProfile | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [eventSlug, setEventSlug] = useState(events[0]?.slug ?? "");
  const [quantity, setQuantity] = useState(1);
  const [paidEach, setPaidEach] = useState("");
  const [askEach, setAskEach] = useState("");
  const savedPhone = splitSavedPhone(savedContact?.contactPhone);
  const [phoneCountry, setPhoneCountry] = useState(savedPhone.iso2);
  const [phoneNational, setPhoneNational] = useState(savedPhone.national);
  const [instagram, setInstagram] = useState(savedContact?.contactInstagram ?? "");
  const [ticketUrl, setTicketUrl] = useState("");
  const [ticketFiles, setTicketFiles] = useState<TicketFile[]>([]);
  const [etName, setEtName] = useState(savedContact?.etransferName ?? "");
  const [etEmail, setEtEmail] = useState(savedContact?.etransferEmail ?? "");
  const savedEtPhone = splitSavedPhone(savedContact?.etransferPhone);
  const [etPhoneCountry, setEtPhoneCountry] = useState(savedEtPhone.iso2);
  const [etPhoneNational, setEtPhoneNational] = useState(savedEtPhone.national);
  const [terms, setTerms] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: QuickActionState, fd: FormData) => {
      fd.delete("ticketImage");
      for (const item of ticketFiles) {
        fd.append("ticketImage", item.file);
      }
      return submitQuickSellAction(prev, fd);
    },
    initial,
  );

  useEffect(() => {
    if (state.ok) router.replace("/go/done?intent=sell");
  }, [state.ok, router]);

  useEffect(() => {
    setTicketFiles((prev) => (prev.length > quantity ? prev.slice(0, quantity) : prev));
  }, [quantity]);

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
  const hasLink = Boolean(ticketUrl.trim());
  const filesReady = ticketFiles.length >= quantity;
  const hasTicket = hasLink || filesReady;
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

        {step === 0 && (
          <>
            <StepHeading eyebrow={stepLabel} title="Which event?" />
            <EventPicker
              events={events}
              value={eventSlug}
              onChange={setEventSlug}
              nightDay={currentBetaWeekday()}
            />
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
            <StepHeading eyebrow={stepLabel} title="Pricing" />
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
            <StepHeading eyebrow={stepLabel} title="How do we reach you?" />
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
              title={quantity > 1 ? "Prove the tickets" : "Prove the ticket"}
              hint={
                quantity > 1
                  ? `Upload a clear screenshot or PDF for each of the ${quantity} tickets, or paste one official share link that covers all of them.`
                  : "Upload a clear screenshot or PDF, or paste the official share link."
              }
            />
            <TicketUploadZone quantity={quantity} files={ticketFiles} onChange={setTicketFiles} />
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
              <p className="text-[13px] text-muted">
                {quantity > 1
                  ? `Add all ${quantity} files, or a link, to continue.`
                  : "Add a file or a link to continue."}
              </p>
            )}
            <label className="flex cursor-pointer items-start gap-3 rounded-[16px] border border-hairline bg-white/[0.04] px-4 py-4">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#6ee1ff]"
              />
              <span className="text-[13px] leading-relaxed text-muted">
                I confirm this is a <span className="font-semibold text-ink">real, unused ticket</span> I
                own, the file/link is accurate and unedited, and I agree to the{" "}
                <Link
                  href={SELLER_TERMS_PATH}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ink underline decoration-dotted underline-offset-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  seller terms
                </Link>{" "}
                (no fakes, follow through on sales, accurate Interac info).
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
            {state.error && (
              <p role="alert" className="text-[13.5px] text-urgency">
                {state.error}
              </p>
            )}
            <TrustNote label={GO_TRUST.sellSubmit.label}>{GO_TRUST.sellSubmit.body}</TrustNote>
            <button type="submit" disabled={!payoutReady || pending} className={BUTTON_CLASS}>
              {pending ? "Submitting…" : "Submit ticket"}
            </button>
          </>
        )}
      </form>
    </QuickShell>
  );
}
