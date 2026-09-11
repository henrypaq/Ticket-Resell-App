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
  composeQuickPhone,
} from "./shared";
import { TicketUploadZone, type TicketFile } from "./ticket-upload";

const initial: QuickActionState = {};
const LAST_STEP = 5;
const TICKET_URL_RE = /^https?:\/\//i;
const TICKET_URL_ERROR = "Paste a full link starting with https://";

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

function isValidTicketUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || TICKET_URL_RE.test(trimmed);
}

export function QuickSellFlow({
  events,
  savedContact,
  initialEventSlug,
  backHref = "/go",
}: {
  events: BetaEvent[];
  savedContact?: GoContactProfile | null;
  initialEventSlug?: string | null;
  /** Where Back goes from the first step (e.g. /member when launched from the app). */
  backHref?: string;
}) {
  const router = useRouter();
  // Deep link from an event card (?event=) locks the venue — skip the picker.
  const eventLocked = Boolean(initialEventSlug?.trim());
  const firstStep = eventLocked ? 1 : 0;
  const totalSteps = LAST_STEP - firstStep + 1;
  const [step, setStep] = useState(firstStep);
  const [tapGuard, setTapGuard] = useState(false);
  const [ticketUrlError, setTicketUrlError] = useState<string | null>(null);
  const preset = eventLocked
    ? initialEventSlug!.trim()
    : (events[0]?.slug ?? "");
  const [eventSlug, setEventSlug] = useState(preset);
  const lockedEvent = events.find((e) => e.slug === eventSlug) ?? null;
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

  // Ticket-proof errors belong on the prove-ticket step, not payout.
  useEffect(() => {
    if (!state.error) return;
    const msg = state.error.toLowerCase();
    if (
      state.error.includes("https://") ||
      msg.includes("link") ||
      msg.includes("upload all") ||
      msg.includes("screenshot")
    ) {
      setTicketUrlError(
        state.error.includes("https://") || msg.includes("link") ? state.error : null,
      );
      setStep(4);
    }
  }, [state.error]);

  // While redirecting to /go/done, keep the last submit state — no interim success page.
  const redirecting = Boolean(state.ok);

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

  const ticketUrlTrimmed = ticketUrl.trim();
  const ticketUrlOk = isValidTicketUrl(ticketUrl);
  const hasValidLink = ticketUrlTrimmed.length > 0 && ticketUrlOk;
  const filesReady = ticketFiles.length >= quantity;
  const hasEvidence = hasValidLink || filesReady;
  const ticketStepReady = hasEvidence && ticketUrlOk && terms;

  const etPhone = composeQuickPhone(etPhoneCountry, etPhoneNational);
  const etPhoneOk = etPhoneNational.replace(/\D/g, "").length >= 7;
  const etEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(etEmail.trim());
  const payoutReady = etName.trim().length > 0 && (etPhoneOk || etEmailOk);

  const etDial = countryByIso2(etPhoneCountry).dial;
  const stepIndex = step - firstStep + 1;
  const stepLabel = `Sell · ${stepIndex} of ${totalSteps}`;
  const isLast = step === LAST_STEP;

  const stepReady =
    (step === 0 && Boolean(eventSlug)) ||
    step === 1 ||
    (step === 2 && pricesOk) ||
    (step === 3 && (phoneOk || igOk)) ||
    (step === 4 && ticketStepReady) ||
    (step === 5 && payoutReady);

  function armTapGuard() {
    setTapGuard(true);
    setTimeout(() => setTapGuard(false), 400);
  }

  function goNext() {
    if (!stepReady || tapGuard || pending || redirecting) return;
    if (step === 4) {
      if (!ticketUrlOk) {
        setTicketUrlError(TICKET_URL_ERROR);
        return;
      }
      setTicketUrlError(null);
    }
    if (step < LAST_STEP) {
      armTapGuard();
      setStep((s) => s + 1);
    }
  }

  function onBack() {
    if (step <= firstStep) {
      router.push(backHref);
      return;
    }
    setStep((s) => s - 1);
  }

  const showFormError =
    Boolean(state.error) &&
    step === LAST_STEP &&
    !state.error?.includes("https://") &&
    !state.error?.toLowerCase().includes("link") &&
    !state.error?.toLowerCase().includes("upload all") &&
    !state.error?.toLowerCase().includes("screenshot");

  return (
    <QuickShell>
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
        encType="multipart/form-data"
        onSubmit={(e) => {
          if (!isLast) {
            e.preventDefault();
            goNext();
          }
        }}
      >
        <input type="hidden" name="eventSlug" value={eventSlug} />
        <input type="hidden" name="quantity" value={quantity} />
        <input type="hidden" name="paidEach" value={paidEach} />
        <input type="hidden" name="askEach" value={askEach} />
        <input type="hidden" name="contactPhone" value={phone} />
        <input type="hidden" name="contactInstagram" value={instagram.replace(/^@+/, "").trim()} />
        <input type="hidden" name="ticketShareUrl" value={ticketUrlTrimmed} />
        <input type="hidden" name="etransferName" value={etName.trim()} />
        <input type="hidden" name="etransferEmail" value={etEmail.trim()} />
        <input type="hidden" name="etransferPhone" value={etPhone} />
        {terms && <input type="hidden" name="sellerTermsAccepted" value="1" />}

        {/* Step body remounts; the CTA below stays mounted so it doesn’t ghost/morph. */}
        <div key={step} className="flex flex-col gap-6">
          {step === 0 && (
            <>
              <StepHeading eyebrow={stepLabel} title="Which event?" />
              <EventPicker events={events} value={eventSlug} onChange={setEventSlug} />
            </>
          )}

          {step === 1 && (
            <>
              <StepHeading eyebrow={stepLabel} title="How many tickets?" />
              {eventLocked && lockedEvent && (
                <p className="text-[13.5px] text-muted">
                  For <span className="font-semibold text-ink">{lockedEvent.name}</span>
                </p>
              )}
              <QuantityStepper value={quantity} onChange={setQuantity} max={2} />
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
                {eventSlug === "cafe-campus" && (
                  <p className="-mt-1 mb-2 text-[13px] leading-relaxed text-muted">
                    View e-tickets from your confirmation email, then copy-paste that URL directly
                    here.
                  </p>
                )}
                <input
                  id="ticketUrl"
                  type="url"
                  placeholder="https://…"
                  value={ticketUrl}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTicketUrl(next);
                    if (!next.trim() || isValidTicketUrl(next)) {
                      setTicketUrlError(null);
                    } else {
                      setTicketUrlError(TICKET_URL_ERROR);
                    }
                  }}
                  onBlur={() => {
                    if (ticketUrl.trim() && !isValidTicketUrl(ticketUrl)) {
                      setTicketUrlError(TICKET_URL_ERROR);
                    }
                  }}
                  className={FIELD_CLASS}
                />
              </Field>
              {(ticketUrlError || (ticketUrlTrimmed.length > 0 && !ticketUrlOk)) && (
                <p role="alert" className="-mt-3 text-[13.5px] text-urgency">
                  {ticketUrlError ?? TICKET_URL_ERROR}
                </p>
              )}
              {!hasEvidence && ticketUrlOk && (
                <p className="-mt-3 text-[13px] text-muted">
                  {quantity > 1
                    ? `Add all ${quantity} files, or a link, to continue.`
                    : "Add a file or a link to continue."}
                </p>
              )}
              {quantity > 1 && ticketFiles.length > 0 && ticketFiles.length < quantity && !hasValidLink && (
                <p className="-mt-3 text-[13.5px] text-urgency">
                  {quantity - ticketFiles.length} more ticket
                  {quantity - ticketFiles.length === 1 ? "" : "s"} needed.
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
            </>
          )}
        </div>

        {showFormError && (
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
              ? "Submitting…"
              : "Submit ticket"
            : "Continue"}
        </button>
      </form>
    </QuickShell>
  );
}
