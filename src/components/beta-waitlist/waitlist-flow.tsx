"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resumeBetaSignupByEmailAction,
  skipBetaSignupAction,
  submitBetaSignupAction,
  type BetaSignupState,
} from "@/domains/beta-signup/actions";
import { INTEREST_OPTIONS } from "@/lib/beta-events";
import { DEFAULT_COUNTRY_ISO2, countryByIso2 } from "@/lib/country-codes";
import { formatPhoneNational } from "@/lib/phone-format";
import { ArrowLeft, CheckIcon } from "@/components/icons";
import { CountryCodeSelect } from "./country-code-select";
import { Field } from "./field";
import { BUTTON_CLASS, FIELD_CLASS, FIELD_GROUP_CLASS } from "./field-styles";
import { Starfield } from "./starfield";

type Answers = {
  name: string;
  email: string;
  phoneCountry: string;
  /** Raw digits only — formatting is applied at display time. */
  phone: string;
  intent: "buy" | "sell" | "both" | "";
  interestedEvents: string[];
  interestedOther: string;
  priority: "speed" | "profit" | "both" | "";
  school: string;
  referralSource: string;
  notifyOptIn: boolean;
};

const EMPTY: Answers = {
  name: "",
  email: "",
  phoneCountry: DEFAULT_COUNTRY_ISO2,
  phone: "",
  intent: "",
  interestedEvents: [],
  interestedOther: "",
  priority: "",
  school: "",
  referralSource: "",
  notifyOptIn: false,
};

/** E.164-ish: dial code + digits only, so downstream SMS sending doesn't need to re-parse free text. */
function composePhone(a: Answers): string {
  const digits = a.phone.replace(/\D/g, "");
  if (!digits) return "";
  return `+${countryByIso2(a.phoneCountry).dial}${digits}`;
}

type Step = {
  id: keyof Answers | "identity" | "consent";
  isComplete: (a: Answers) => boolean;
};

const STEPS: Step[] = [
  // Email alone is enough to Continue — returning visitors resume that way;
  // new signups still need a name (phone is optional).
  { id: "identity", isComplete: (a) => isValidEmail(a.email) },
  { id: "intent", isComplete: (a) => a.intent !== "" },
  { id: "interestedEvents", isComplete: () => true },
  { id: "priority", isComplete: (a) => a.priority !== "" },
  { id: "school", isComplete: () => true },
  { id: "referralSource", isComplete: () => true },
  { id: "consent", isComplete: () => true },
];

function identityReadyForNewSignup(a: Answers) {
  return a.name.trim().length > 0 && isValidEmail(a.email);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const initialActionState: BetaSignupState = {};

/**
 * One question per screen, dark/high-tech. Client-only step navigation —
 * every field lives in `answers` state so it survives moving back and forth,
 * and gets serialized into hidden inputs on the single <form> that actually
 * submits (only mounted, and only submittable, on the last step).
 */
export function WaitlistFlow({ showDevSkip = false }: { showDevSkip?: boolean }) {
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState(0);
  const [state, formAction, pending] = useActionState(submitBetaSignupAction, initialActionState);
  const [skipped, setSkipped] = useState(false);
  const [skipPending, startSkip] = useTransition();
  const [skipError, setSkipError] = useState<string | null>(null);
  const [resumePending, startResume] = useTransition();
  const [resumeError, setResumeError] = useState<string | null>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const canAdvance = current.isComplete(answers);
  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  // The Continue / Join-the-beta button sits in the exact same screen spot on
  // every step. Tapping through quickly is normal — but if that rhythm lands
  // a second tap right after a step transition, it can hit the newly-mounted
  // button before the user has actually looked at the new screen (worst case:
  // an accidental submit on the last step, before they've seen the consent
  // checkbox at all). Arming the guard here, in the click handler that causes
  // the transition, rather than in a useEffect keyed on `step` — setting
  // state synchronously inside an effect just to react to its own dependency
  // changing is the exact cascading-render pattern React's effect rules warn
  // against; doing it directly in the event handler that changes `step` gets
  // the same behavior without that.
  const [tapGuard, setTapGuard] = useState(false);

  if (state.ok || skipped) {
    return <SignupCompleteRefresh />;
  }

  function next() {
    if (!canAdvance) return;

    // Identity step: try resume-by-email first so returning visitors don't
    // redo the questionnaire. New emails still need a name filled in.
    if (current.id === "identity") {
      setResumeError(null);
      startResume(async () => {
        const result = await resumeBetaSignupByEmailAction(answers.email);
        if (!result.ok) {
          setResumeError(result.error);
          return;
        }
        if (result.resumed) {
          setSkipped(true);
          return;
        }
        if (!identityReadyForNewSignup(answers)) {
          setResumeError("New here? Add your name to join the beta.");
          return;
        }
        setTapGuard(true);
        setTimeout(() => setTapGuard(false), 400);
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
      });
      return;
    }

    setTapGuard(true);
    setTimeout(() => setTapGuard(false), 400);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function toggleEvent(value: string) {
    setAnswers((a) => ({
      ...a,
      interestedEvents: a.interestedEvents.includes(value)
        ? a.interestedEvents.filter((v) => v !== value)
        : [...a.interestedEvents, value],
    }));
  }

  function onSkip() {
    setSkipError(null);
    startSkip(async () => {
      const result = await skipBetaSignupAction();
      if (result.error) {
        setSkipError(result.error);
        return;
      }
      setSkipped(true);
    });
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8 sm:px-6">
      <Starfield />
      <Glow />

      {showDevSkip && (
        <div className="relative mb-3 flex items-center justify-end gap-2">
          {skipError && <span className="text-[12px] text-urgency">{skipError}</span>}
          <button
            type="button"
            onClick={onSkip}
            disabled={skipPending}
            className="text-[12px] font-semibold text-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-ink disabled:opacity-60"
          >
            {skipPending ? "Skipping…" : "Skip to beta view (dev)"}
          </button>
        </div>
      )}

      {step > 0 && (
        <header className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="pill flex h-11 w-11 shrink-0 items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[#ffe500] transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Mirrors the back button's width so the track is centered in the row, not just in the leftover space beside the button. */}
          <div aria-hidden className="h-11 w-11 shrink-0" />
        </header>
      )}

      <form
        action={formAction}
        onSubmit={(e) => {
          // Steps with exactly one text field (interestedEvents' "Other",
          // school, referralSource's "Other") have no <button type="submit">
          // in the DOM until the last step — per the HTML spec, that makes
          // Enter (or a mobile keyboard's "Go"/"Done" key) implicitly submit
          // the form early instead of doing nothing. Treat that submit as a
          // Continue tap on every step but the last.
          if (!isLast) {
            e.preventDefault();
            next();
          }
        }}
        className={`relative flex flex-col ${step > 0 ? "mt-10" : "mt-2"}`}
      >
        <HiddenFields answers={answers} exclude={current.id} />

        <div key={step} className="flex flex-col animate-[betaStepIn_320ms_ease-out]">
          {current.id === "identity" && (
            <IdentityStep answers={answers} setAnswers={setAnswers} />
          )}
          {current.id === "intent" && <IntentStep answers={answers} setAnswers={setAnswers} />}
          {current.id === "interestedEvents" && (
            <InterestedEventsStep answers={answers} setAnswers={setAnswers} toggleEvent={toggleEvent} />
          )}
          {current.id === "priority" && <PriorityStep answers={answers} setAnswers={setAnswers} />}
          {current.id === "school" && <SchoolStep answers={answers} setAnswers={setAnswers} />}
          {current.id === "referralSource" && (
            <ReferralStep answers={answers} setAnswers={setAnswers} />
          )}
          {current.id === "consent" && <ConsentStep answers={answers} setAnswers={setAnswers} />}
        </div>

        {resumeError && (
          <p role="alert" className="mt-4 text-[13.5px] leading-relaxed text-urgency">
            {resumeError}
          </p>
        )}

        {state.error && (
          <p role="alert" className="mt-4 text-[13.5px] leading-relaxed text-urgency">
            {state.error}
          </p>
        )}

        <div className="mt-6 flex justify-end pb-[max(1rem,env(safe-area-inset-bottom))]">
          {isLast ? (
            <button
              type="submit"
              disabled={pending || tapGuard}
              className={BUTTON_CLASS}
            >
              {pending ? "Joining…" : "Join the beta"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={!canAdvance || tapGuard || resumePending}
              className={BUTTON_CLASS}
            >
              {resumePending && current.id === "identity" ? "Checking…" : "Continue"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/** Every answered field not currently visible gets a hidden input, so the final submit carries the whole form. */
function HiddenFields({ answers, exclude }: { answers: Answers; exclude: Step["id"] }) {
  return (
    <>
      {exclude !== "identity" && (
        <>
          <input type="hidden" name="name" value={answers.name} />
          <input type="hidden" name="email" value={answers.email} />
          <input type="hidden" name="phone" value={composePhone(answers)} />
        </>
      )}
      {exclude !== "intent" && <input type="hidden" name="intent" value={answers.intent} />}
      {exclude !== "interestedEvents" &&
        answers.interestedEvents.map((v) => (
          <input key={v} type="hidden" name="interestedEvents" value={v} />
        ))}
      {exclude !== "interestedEvents" && (
        <input type="hidden" name="interestedOther" value={answers.interestedOther} />
      )}
      {exclude !== "priority" && <input type="hidden" name="priority" value={answers.priority} />}
      {exclude !== "school" && <input type="hidden" name="school" value={answers.school} />}
      {exclude !== "referralSource" && (
        <input type="hidden" name="referralSource" value={answers.referralSource} />
      )}
      {exclude !== "consent" && (
        <input type="hidden" name="notifyOptIn" value={answers.notifyOptIn ? "on" : ""} />
      )}
    </>
  );
}

type StepProps = { answers: Answers; setAnswers: React.Dispatch<React.SetStateAction<Answers>> };

function QuestionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <p className="section-header text-[12px] text-muted">{eyebrow}</p>
      <h1 className="headline mt-3 text-[30px] leading-[1.15] tracking-tight">{title}</h1>
    </>
  );
}

function IdentityStep({ answers, setAnswers }: StepProps) {
  const dial = countryByIso2(answers.phoneCountry).dial;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="headline text-[34px] leading-[1.15] tracking-tight">
          THE MCGILL.TICKETS APP IS LAUNCHING SOON
        </h1>
        <p className="mt-4 text-[17px] font-semibold text-[#ffe500]">This is our beta.</p>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Sign up to be notified of available tickets for sold-out events, or resell your extra
          tickets at full price.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Beta members will get priority access to tickets for their favourite events on launch.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Field label="Full name" htmlFor="name">
          <input
            id="name"
            autoFocus
            name="name"
            placeholder="Jane Doe"
            autoComplete="name"
            autoCapitalize="words"
            value={answers.name}
            onChange={(e) => setAnswers((a) => ({ ...a, name: e.target.value }))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            name="email"
            placeholder="jane@email.com"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            value={answers.email}
            onChange={(e) => setAnswers((a) => ({ ...a, email: e.target.value }))}
            className={FIELD_CLASS}
          />
        </Field>
        <p className="-mt-1 text-[12.5px] leading-relaxed text-muted">
          Already joined? Enter the same email and hit Continue — we&apos;ll bring you back in.
        </p>
        <Field label="Phone number (optional)" htmlFor="phone">
          <div className={FIELD_GROUP_CLASS}>
            <CountryCodeSelect
              value={answers.phoneCountry}
              onChange={(iso2) => setAnswers((a) => ({ ...a, phoneCountry: iso2 }))}
              className="border-r border-white/10"
            />
            <input
              id="phone"
              type="tel"
              name="phone"
              placeholder={dial === "1" ? "(514) 555-0123" : "Phone number"}
              autoComplete="tel-national"
              inputMode="tel"
              value={formatPhoneNational(answers.phone, dial)}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, phone: e.target.value.replace(/\D/g, "").slice(0, 15) }))
              }
              className="min-w-0 flex-1 bg-transparent py-4 pl-3 pr-5 text-[16px] text-ink outline-none placeholder:text-muted/70"
            />
          </div>
        </Field>
      </div>
    </div>
  );
}

function OptionCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left text-[15px] font-semibold transition-colors ${
        selected
          ? "border-[#6ee1ff]/50 bg-[#6ee1ff]/10 text-ink"
          : "border-hairline bg-card text-ink hover:bg-white/5"
      }`}
    >
      {children}
      {selected && <CheckIcon className="h-4 w-4 shrink-0 text-[#6ee1ff]" />}
    </button>
  );
}

function IntentStep({ answers, setAnswers }: StepProps) {
  const options: { value: Answers["intent"]; label: string; hint: string }[] = [
    { value: "buy", label: "Buy tickets", hint: "I'm looking for tickets to sold-out events." },
    { value: "sell", label: "Sell tickets", hint: "I've got tickets I can't use." },
    { value: "both", label: "Both", hint: "Depends on the event." },
  ];
  return (
    <div className="flex flex-col gap-5">
      <QuestionHeading eyebrow="Step 2 of 7" title="Do you want to buy or sell tickets?" />
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <OptionCard
            key={o.value}
            selected={answers.intent === o.value}
            onClick={() => setAnswers((a) => ({ ...a, intent: o.value }))}
          >
            <span>
              <span className="block">{o.label}</span>
              <span className="mt-0.5 block text-[13px] font-normal text-muted">{o.hint}</span>
            </span>
          </OptionCard>
        ))}
      </div>
    </div>
  );
}

function InterestedEventsStep({
  answers,
  setAnswers,
  toggleEvent,
}: StepProps & { toggleEvent: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <QuestionHeading eyebrow="Step 3 of 7" title="Which events are you most interested in?" />
      <p className="-mt-2 text-[13.5px] text-muted">Select all that apply.</p>
      <div className="flex flex-wrap gap-2">
        {INTEREST_OPTIONS.map((o) => {
          const selected = answers.interestedEvents.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleEvent(o.value)}
              className={`rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${
                selected
                  ? "border-[#6ee1ff]/50 bg-[#6ee1ff]/10 text-ink"
                  : "border-white/15 bg-transparent text-ink hover:bg-white/5"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <Field label="Other" htmlFor="interestedOther">
        <input
          id="interestedOther"
          name="interestedOther"
          placeholder="e.g. Stereo, MTELUS…"
          value={answers.interestedOther}
          onChange={(e) => setAnswers((a) => ({ ...a, interestedOther: e.target.value }))}
          className={FIELD_CLASS}
        />
      </Field>
    </div>
  );
}

function PriorityStep({ answers, setAnswers }: StepProps) {
  const options: { value: Answers["priority"]; label: string; hint: string }[] = [
    { value: "speed", label: "Selling quickly", hint: "I want to get my money back asap" },
    { value: "profit", label: "Making a profit", hint: "I want to upsell my tickets and make money" },
    { value: "both", label: "Both", hint: "Depends on the event" },
  ];
  return (
    <div className="flex flex-col gap-5">
      <QuestionHeading eyebrow="Step 4 of 7" title="What matters more when selling tickets?" />
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <OptionCard
            key={o.value}
            selected={answers.priority === o.value}
            onClick={() => setAnswers((a) => ({ ...a, priority: o.value }))}
          >
            <span>
              <span className="block">{o.label}</span>
              <span className="mt-0.5 block text-[13px] font-normal text-muted">{o.hint}</span>
            </span>
          </OptionCard>
        ))}
      </div>
    </div>
  );
}

function SchoolStep({ answers, setAnswers }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <QuestionHeading eyebrow="Step 5 of 7" title="School and faculty, if that applies to you." />
      <input
        name="school"
        aria-label="School and faculty (optional)"
        placeholder="e.g. McGill — Management"
        value={answers.school}
        onChange={(e) => setAnswers((a) => ({ ...a, school: e.target.value }))}
        className={FIELD_CLASS}
      />
    </div>
  );
}

const REFERRAL_OPTIONS = ["Instagram", "Snapchat", "TikTok", "Friend", "Campus flyer"];

function ReferralStep({ answers, setAnswers }: StepProps) {
  const isPreset = REFERRAL_OPTIONS.includes(answers.referralSource);
  const otherValue = isPreset ? "" : answers.referralSource;

  return (
    <div className="flex flex-col gap-5">
      <QuestionHeading eyebrow="Step 6 of 7" title="How did you hear about us?" />
      <div className="flex flex-wrap gap-2">
        {REFERRAL_OPTIONS.map((option) => {
          const selected = answers.referralSource === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setAnswers((a) => ({ ...a, referralSource: option }))}
              className={`rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${
                selected
                  ? "border-[#6ee1ff]/50 bg-[#6ee1ff]/10 text-ink"
                  : "border-white/15 bg-transparent text-ink hover:bg-white/5"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      <Field label="Other" htmlFor="referralSource">
        <input
          id="referralSource"
          name="referralSource"
          placeholder="e.g. a roommate, group chat…"
          value={otherValue}
          onChange={(e) => setAnswers((a) => ({ ...a, referralSource: e.target.value }))}
          className={FIELD_CLASS}
        />
      </Field>
    </div>
  );
}

function ConsentStep({ answers, setAnswers }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <QuestionHeading eyebrow="Step 7 of 7" title="Almost there." />
      <p className="text-[14px] leading-relaxed text-muted">
        We&apos;ll email you when your spot opens up. Want text updates too, for things like ticket
        availability and checkout windows?
      </p>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-hairline bg-card px-5 py-4">
        <input
          type="checkbox"
          name="notifyOptIn"
          checked={answers.notifyOptIn}
          onChange={(e) => setAnswers((a) => ({ ...a, notifyOptIn: e.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#6ee1ff]"
        />
        <span className="text-[14px] leading-relaxed text-ink">
          Yes, text me at the number I gave above with ticket availability and checkout updates.
        </span>
      </label>
    </div>
  );
}

function Glow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60"
      style={{
        background:
          "radial-gradient(60% 60% at 50% 0%, rgba(110,225,255,0.16) 0%, rgba(110,225,255,0.06) 45%, transparent 75%)",
      }}
    />
  );
}

/** Cookie is set server-side on submit — refresh so `/` swaps to the beta shell. */
function SignupCompleteRefresh() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-5">
      <Starfield />
      <Glow />
      <p className="text-[14px] text-muted">You&apos;re in — loading your beta…</p>
    </div>
  );
}
