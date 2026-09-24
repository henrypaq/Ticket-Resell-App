"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  finishAccountSetupAction,
  type BetaActionState,
} from "@/domains/beta-signup/actions";
import type { ProfilePrefillData } from "@/domains/beta-quick/shared";
import { DEFAULT_COUNTRY_ISO2, countryByIso2, COUNTRY_CODES } from "@/lib/country-codes";
import { formatPhoneNational } from "@/lib/phone-format";
import { CountryCodeSelect } from "@/components/forms/country-code-select";
import { Field } from "@/components/forms/field";
import { BUTTON_CLASS, FIELD_CLASS, FIELD_GROUP_CLASS } from "@/components/forms/field-styles";
import { AppFlowShell } from "./shell";
import { ArrowLeft } from "@/components/icons";
import { GoogleContinueButton } from "./google-continue-button";
import { safeReturnPath } from "@/lib/safe-return-path";

function splitPhone(e164: string | null | undefined): { iso2: string; national: string } {
  const digits = (e164 ?? "").replace(/\D/g, "");
  if (!digits) return { iso2: DEFAULT_COUNTRY_ISO2, national: "" };
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial) && digits.length > c.dial.length) {
      if (c.dial === "1") return { iso2: "CA", national: digits.slice(1) };
      return { iso2: c.iso2, national: digits.slice(c.dial.length) };
    }
  }
  return { iso2: DEFAULT_COUNTRY_ISO2, national: digits };
}

function SetupStepTracker({
  step,
  labels,
}: {
  step: number;
  labels: string[];
}) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-1.5">
        {labels.map((_, i) => (
          <div
            key={labels[i]}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-brand" : "bg-white/10"
            }`}
            aria-hidden
          />
        ))}
      </div>
      <p className="font-ui mt-2.5 text-[12px] font-medium tracking-tight text-muted">
        Step {step + 1} of {labels.length}
        <span className="text-ink/80"> · {labels[step]}</span>
      </p>
    </div>
  );
}

/**
 * Multi-step account setup after buy/sell:
 * password → contact → Interac payout (or payout-only after Google).
 */
export function FinishAccountSetup({
  prefill,
  intent,
  returnTo,
  mode = "full",
  googleNextPath,
}: {
  prefill: ProfilePrefillData;
  intent: "buy" | "sell";
  returnTo: string;
  /** `payout` = account already linked (e.g. via Google); only Interac left. */
  mode?: "full" | "payout";
  /** Where Google OAuth should resume (usually this /setup URL). */
  googleNextPath?: string;
}) {
  const next = safeReturnPath(returnTo);
  const fullLabels = ["Password", "Contact", "Payout"];
  const payoutLabels = ["Payout"];
  const labels = mode === "payout" ? payoutLabels : fullLabels;
  const [step, setStep] = useState(0);

  const savedPhone = splitPhone(prefill.phone);
  const savedEtPhone = splitPhone(prefill.etransferPhone);

  const [name, setName] = useState(prefill.name ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [country, setCountry] = useState(savedPhone.iso2);
  const [national, setNational] = useState(savedPhone.national);
  const [notifyOptIn, setNotifyOptIn] = useState(false);

  const [etName, setEtName] = useState(prefill.etransferName ?? prefill.name ?? "");
  const [etEmail, setEtEmail] = useState(prefill.etransferEmail ?? "");
  const [etPhoneCountry, setEtPhoneCountry] = useState(savedEtPhone.iso2);
  const [etPhoneNational, setEtPhoneNational] = useState(savedEtPhone.national);

  const [state, formAction, pending] = useActionState(
    finishAccountSetupAction,
    {} as BetaActionState,
  );

  const dial = countryByIso2(country).dial;
  const digits = national.replace(/\D/g, "");
  const composedPhone = digits ? `+${dial}${digits}` : "";

  const etDial = countryByIso2(etPhoneCountry).dial;
  const etDigits = etPhoneNational.replace(/\D/g, "");
  const composedEtPhone = etDigits ? `+${etDial}${etDigits}` : "";

  const hasIg = (prefill.contactInstagram ?? "").replace(/^@+/, "").length >= 2;
  const passwordOk =
    password.length >= 8 && password === passwordConfirm && !/\s/.test(password);
  const contactOk = digits.length >= 7 || hasIg;
  const nameEmailOk =
    name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const etEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(etEmail.trim());
  const etPhoneOk = etDigits.length >= 7;
  const payoutOk = etName.trim().length > 0 && (etEmailOk || etPhoneOk) && contactOk;

  const stepReady =
    mode === "payout"
      ? payoutOk
      : step === 0
        ? nameEmailOk && passwordOk
        : step === 1
          ? contactOk
          : payoutOk;

  const returnLabel = next.startsWith("/offer/")
    ? "Continue to claim & pay"
    : next === "/"
      ? "Back to home"
      : "Continue";

  const isLast = mode === "payout" || step === 2;

  if (state.ok) {
    return (
      <AppFlowShell>
        <div className="flex flex-1 flex-col">
          <p className="font-ui text-[15px] font-semibold tracking-tight text-brand">
            mcgill.tickets
          </p>
          <h1 className="headline mt-8 text-[28px] leading-[1.15] tracking-tight">
            Account saved
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
            {state.message ??
              "Your profile is ready. Sign in anytime with your email and password."}
          </p>
          <Link href={next} className={`${BUTTON_CLASS} mt-10 w-full`}>
            {returnLabel}
          </Link>
        </div>
      </AppFlowShell>
    );
  }

  return (
    <AppFlowShell>
      <button
        type="button"
        onClick={() => {
          if (mode === "full" && step > 0) setStep(step - 1);
          else window.location.assign(next);
        }}
        className="font-ui inline-flex items-center gap-2 self-start text-[13.5px] font-semibold text-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <SetupStepTracker step={step} labels={labels} />

      <form
        action={formAction}
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          if (!isLast) {
            e.preventDefault();
            if (stepReady) setStep((s) => s + 1);
          }
        }}
      >
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="eventName" value={prefill.eventName ?? ""} />
        <input type="hidden" name="referralSource" value={prefill.referralSource ?? ""} />
        <input type="hidden" name="contactInstagram" value={prefill.contactInstagram ?? ""} />
        <input type="hidden" name="name" value={name.trim()} />
        <input type="hidden" name="email" value={email.trim()} />
        <input type="hidden" name="phone" value={composedPhone} />
        <input type="hidden" name="password" value={password} />
        <input type="hidden" name="etransferName" value={etName.trim()} />
        <input type="hidden" name="etransferEmail" value={etEmail.trim()} />
        <input type="hidden" name="etransferPhone" value={composedEtPhone} />
        {notifyOptIn && <input type="hidden" name="notifyOptIn" value="on" />}
        {mode === "payout" && <input type="hidden" name="skipPassword" value="1" />}

        <div className="flex flex-col gap-5">
          {mode === "full" && step === 0 && (
            <>
              <div>
                <h1 className="headline text-[26px] leading-[1.15] tracking-tight">
                  Create a password
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  You’ll use this email and password to sign in and access your account later.
                </p>
              </div>

              {googleNextPath && (
                <>
                  <GoogleContinueButton nextPath={googleNextPath} label="Continue with Google" />
                  <div className="flex items-center gap-3" aria-hidden>
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                      or
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                </>
              )}

              <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3.5">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Account
                </p>
                <p className="mt-1.5 text-[14.5px] font-medium text-ink">{name || "—"}</p>
                <p className="mt-0.5 text-[13.5px] text-muted">{email || "—"}</p>
              </div>

              {/* Keep editable in case they landed without done-page fields */}
              {(!prefill.name || !prefill.email) && (
                <>
                  <Field label="Full name" htmlFor="setup-name">
                    <input
                      id="setup-name"
                      required
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      className={FIELD_CLASS}
                    />
                  </Field>
                  <Field label="Email" htmlFor="setup-email">
                    <input
                      id="setup-email"
                      type="email"
                      required
                      placeholder="jane@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className={FIELD_CLASS}
                    />
                  </Field>
                </>
              )}

              <Field label="Password" htmlFor="setup-password">
                <input
                  id="setup-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={FIELD_CLASS}
                />
              </Field>
              <Field label="Confirm password" htmlFor="setup-password-confirm">
                <input
                  id="setup-password-confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className={FIELD_CLASS}
                />
              </Field>
              {passwordConfirm.length > 0 && password !== passwordConfirm && (
                <p className="-mt-2 text-[12.5px] text-urgency">Passwords don’t match.</p>
              )}
            </>
          )}

          {mode === "full" && step === 1 && (
            <>
              <div>
                <h1 className="headline text-[26px] leading-[1.15] tracking-tight">
                  How we reach you
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Phone for holds and alerts. You can change this anytime in settings.
                </p>
              </div>

              <Field label="Phone number" htmlFor="setup-phone">
                <div className={FIELD_GROUP_CLASS}>
                  <CountryCodeSelect
                    value={country}
                    onChange={setCountry}
                    className="border-r border-white/10"
                  />
                  <input
                    id="setup-phone"
                    type="tel"
                    placeholder={dial === "1" ? "(514) 555-0123" : "Phone number"}
                    value={formatPhoneNational(digits, dial)}
                    onChange={(e) => setNational(e.target.value.replace(/\D/g, "").slice(0, 15))}
                    autoComplete="tel-national"
                    inputMode="tel"
                    className="min-w-0 flex-1 bg-transparent py-4 pl-3 pr-5 text-[16px] text-ink outline-none placeholder:text-muted/70"
                  />
                </div>
              </Field>

              {/*
                Wording is Twilio toll-free verification evidence and must stay
                identical to /sms-opt-in. Don't reword alone.
              */}
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-hairline bg-card px-5 py-4">
                <input
                  type="checkbox"
                  checked={notifyOptIn}
                  onChange={(e) => setNotifyOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#6ee1ff]"
                />
                <span className="text-[14px] leading-relaxed text-ink">
                  Yes, text me with ticket availability and checkout updates
                </span>
              </label>
              <p className="-mt-2 text-[12px] leading-relaxed text-muted">
                Message frequency varies. Reply STOP to opt out, HELP for help. Msg &amp; data rates
                may apply.
              </p>
            </>
          )}

          {(mode === "payout" || step === 2) && (
            <>
              <div>
                <h1 className="headline text-[26px] leading-[1.15] tracking-tight">
                  Interac payout
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  Where we send money when your ticket sells. This can differ from your account
                  email.
                </p>
              </div>

              {!contactOk && (
                <Field label="Phone number" htmlFor="setup-phone-payout">
                  <div className={FIELD_GROUP_CLASS}>
                    <CountryCodeSelect
                      value={country}
                      onChange={setCountry}
                      className="border-r border-white/10"
                    />
                    <input
                      id="setup-phone-payout"
                      type="tel"
                      placeholder={dial === "1" ? "(514) 555-0123" : "Phone number"}
                      value={formatPhoneNational(digits, dial)}
                      onChange={(e) => setNational(e.target.value.replace(/\D/g, "").slice(0, 15))}
                      autoComplete="tel-national"
                      inputMode="tel"
                      className="min-w-0 flex-1 bg-transparent py-4 pl-3 pr-5 text-[16px] text-ink outline-none placeholder:text-muted/70"
                    />
                  </div>
                </Field>
              )}

              <Field label="Name on Interac account" htmlFor="setup-et-name">
                <input
                  id="setup-et-name"
                  required
                  placeholder="Jane Doe"
                  value={etName}
                  onChange={(e) => setEtName(e.target.value)}
                  autoComplete="name"
                  className={FIELD_CLASS}
                />
              </Field>

              <Field label="Interac email" htmlFor="setup-et-email">
                <input
                  id="setup-et-email"
                  type="email"
                  placeholder="jane@email.com"
                  value={etEmail}
                  onChange={(e) => setEtEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="off"
                  className={FIELD_CLASS}
                />
              </Field>

              <Field label="Or Interac phone number" htmlFor="setup-et-phone">
                <div className={FIELD_GROUP_CLASS}>
                  <CountryCodeSelect
                    value={etPhoneCountry}
                    onChange={setEtPhoneCountry}
                    className="border-r border-white/10"
                  />
                  <input
                    id="setup-et-phone"
                    type="tel"
                    placeholder={etDial === "1" ? "(514) 555-0123" : "Phone number"}
                    value={formatPhoneNational(etDigits, etDial)}
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

        {state.error && (
          <p role="alert" className="mt-4 text-[13.5px] text-urgency">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !stepReady}
          className={`${BUTTON_CLASS} mt-8 w-full`}
        >
          {!isLast ? "Continue" : pending ? "Saving…" : "Save account"}
        </button>

        <button
          type="button"
          onClick={() => window.location.assign(next)}
          className="font-ui mt-4 text-center text-[13.5px] font-medium text-muted underline decoration-white/20 underline-offset-4 hover:text-ink"
        >
          Skip for now
        </button>
      </form>
    </AppFlowShell>
  );
}
