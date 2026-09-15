"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resetBetaSignupAction,
  submitBetaSupportAction,
  updateBetaContactAction,
  updateBetaNotificationPrefsAction,
  type BetaActionState,
} from "@/domains/beta-signup/actions";
import { SUPPORT_CATEGORIES, type BetaSignupProfile } from "@/domains/beta-signup/shared";
import type { ProfilePrefillData } from "@/domains/beta-quick/shared";
import { SaveProfileCard } from "./save-profile";
import { BETA_SOCIALS } from "@/lib/beta-events";
import { COUNTRY_CODES, DEFAULT_COUNTRY_ISO2, countryByIso2 } from "@/lib/country-codes";
import { formatPhoneNational } from "@/lib/phone-format";
import { ArrowLeft, InstagramIcon, SnapchatIcon } from "@/components/icons";
import { CountryCodeSelect } from "@/components/forms/country-code-select";
import { Field } from "@/components/forms/field";
import {
  BUTTON_CLASS,
  BUTTON_CLASS_COMPACT,
  FIELD_CLASS,
  FIELD_GROUP_CLASS,
} from "@/components/forms/field-styles";

type PrefKey = "notifyQueueEmail" | "notifyQueueSms" | "notifyTicketsEmail" | "notifyTicketsSms";
type Prefs = Record<PrefKey, boolean>;

/**
 * Everything behind the account button: who you are, how we reach you, and
 * how to reach us. This is the old `/member` Notis and Contact tabs plus name
 * editing — the bottom nav that used to hold them is gone.
 *
 * Reachable without a profile. There's no sign-up wall on the app, so plenty
 * of people arrive here having only ever run a buy or sell flow: they get the
 * save-profile card where the editable fields would be, and "contact us"
 * works either way (support messages accept a null member).
 */
export function AppSettings({
  profile,
  prefill,
  showDevReset = false,
}: {
  profile: BetaSignupProfile | null;
  /** Prefill for the save-profile card, when they have no profile yet. */
  prefill?: ProfilePrefillData | null;
  showDevReset?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="relative flex flex-col gap-12 pt-3">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="inline-flex items-center gap-2 self-start text-[13.5px] font-semibold text-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <header>
        <h1 className="headline text-[30px] leading-[1.12] tracking-tight">Your account</h1>
      </header>

      {profile ? (
        <>
          <section>
            <p className="section-header mb-4 text-[12px] text-muted">Personal info</p>
            <PersonalInfoForm profile={profile} />
          </section>

          <section>
            <p className="section-header mb-4 text-[12px] text-muted">Communication settings</p>
            <PrefsForm profile={profile} />
          </section>
        </>
      ) : (
        <section>
          <p className="section-header mb-4 text-[12px] text-muted">Personal info</p>
          <SaveProfileCard
            prefill={{
              name: prefill?.name,
              email: prefill?.email,
              phone: prefill?.phone,
              intent: prefill?.intent,
              eventName: prefill?.eventName,
              referralSource: prefill?.referralSource,
            }}
            heading="Save your profile"
            blurb="Your details live in this browser right now. Saving them lets us reach you about matches and keeps your tickets if you switch devices."
          />
        </section>
      )}

      <section>
        <p className="section-header mb-4 text-[12px] text-muted">Contact us</p>
        <SupportForm profile={profile} />
        <div className="mt-6 flex items-center gap-3">
          <a
            href={BETA_SOCIALS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="transition-transform hover:scale-105"
          >
            <InstagramIcon className="h-9 w-9" />
          </a>
          <a
            href={BETA_SOCIALS.snapchat}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Snapchat"
            className="transition-transform hover:scale-105"
          >
            <SnapchatIcon className="h-9 w-9" />
          </a>
        </div>
      </section>

      <section className="border-t border-hairline pt-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-[14px] font-semibold text-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
        >
          Back to home
        </button>
        {showDevReset && <DevReset />}
      </section>
    </div>
  );
}

function PersonalInfoForm({ profile }: { profile: BetaSignupProfile }) {
  const parsed = splitPhone(profile.phone);
  const initialDigits = profile.phone.replace(/\D/g, "");
  const initialPhone = initialDigits ? `+${initialDigits}` : "";

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [country, setCountry] = useState(parsed.country);
  const [national, setNational] = useState(parsed.national);
  const [savedName, setSavedName] = useState(profile.name.trim());
  const [savedEmail, setSavedEmail] = useState(profile.email.trim().toLowerCase());
  const [savedPhone, setSavedPhone] = useState(initialPhone);
  const [state, setState] = useState<BetaActionState>({});
  const [pending, startTransition] = useTransition();

  const dial = countryByIso2(country).dial;
  const digits = national.replace(/\D/g, "");
  const composedPhone = digits ? `+${dial}${digits}` : "";
  const nameValid = name.trim().length > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const dirty =
    name.trim() !== savedName ||
    email.trim().toLowerCase() !== savedEmail ||
    composedPhone !== savedPhone;
  const canSave = nameValid && emailValid && dirty && !pending;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;
    const fd = new FormData(e.currentTarget);
    setState({});
    startTransition(async () => {
      const result = await updateBetaContactAction({}, fd);
      setState(result);
      if (result.ok) {
        setSavedName(name.trim());
        setSavedEmail(email.trim().toLowerCase());
        setSavedPhone(composedPhone);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field label="Full name" htmlFor="settings-name">
        <input
          id="settings-name"
          name="name"
          required
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          autoCapitalize="words"
          className={FIELD_CLASS}
        />
      </Field>
      <Field label="Email" htmlFor="settings-email">
        <input
          id="settings-email"
          type="email"
          name="email"
          required
          placeholder="jane@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={FIELD_CLASS}
        />
      </Field>
      <Field label="Phone number (optional)" htmlFor="settings-phone">
        <div className={FIELD_GROUP_CLASS}>
          <CountryCodeSelect
            value={country}
            onChange={setCountry}
            className="border-r border-white/10"
          />
          <input
            id="settings-phone"
            type="tel"
            placeholder={dial === "1" ? "(514) 555-0123" : "Phone number"}
            value={formatPhoneNational(digits, dial)}
            onChange={(e) => setNational(e.target.value.replace(/\D/g, "").slice(0, 15))}
            autoComplete="tel-national"
            inputMode="tel"
            className="min-w-0 flex-1 bg-transparent py-4 pl-3 pr-5 text-[16px] text-ink outline-none placeholder:text-muted/70"
          />
          <input type="hidden" name="phone" value={composedPhone} />
        </div>
      </Field>
      <p className="text-[12px] leading-relaxed text-muted">
        Keep your email current — it&apos;s how we&apos;ll send most alerts for now about the tickets
        you list and the waitlists you join.
      </p>
      <StatusLine state={state} />
      <button type="submit" disabled={!canSave} className={`mt-2 ${BUTTON_CLASS_COMPACT}`}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function PrefsForm({ profile }: { profile: BetaSignupProfile }) {
  const [prefs, setPrefs] = useState<Prefs>({
    notifyQueueEmail: profile.notifyQueueEmail,
    notifyQueueSms: profile.notifyQueueSms,
    notifyTicketsEmail: profile.notifyTicketsEmail,
    notifyTicketsSms: profile.notifyTicketsSms,
  });
  const [state, setState] = useState<BetaActionState>({});
  const [pending, startTransition] = useTransition();

  function toggle(key: PrefKey) {
    const next: Prefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setState({});

    startTransition(async () => {
      const fd = new FormData();
      if (next.notifyQueueEmail) fd.set("notifyQueueEmail", "on");
      if (next.notifyQueueSms) fd.set("notifyQueueSms", "on");
      if (next.notifyTicketsEmail) fd.set("notifyTicketsEmail", "on");
      if (next.notifyTicketsSms) fd.set("notifyTicketsSms", "on");

      const result = await updateBetaNotificationPrefsAction({}, fd);
      if (result.error) {
        setPrefs(prefs);
        setState({ error: result.error });
        return;
      }
      setState({ ok: true, message: result.message ?? "Saved." });
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <PrefRow
        label="#1 in the waitlist"
        emailChecked={prefs.notifyQueueEmail}
        smsChecked={prefs.notifyQueueSms}
        disabled={pending}
        onToggleEmail={() => toggle("notifyQueueEmail")}
        onToggleSms={() => toggle("notifyQueueSms")}
      />
      <PrefRow
        label="Available tickets"
        emailChecked={prefs.notifyTicketsEmail}
        smsChecked={prefs.notifyTicketsSms}
        disabled={pending}
        onToggleEmail={() => toggle("notifyTicketsEmail")}
        onToggleSms={() => toggle("notifyTicketsSms")}
      />

      <StatusLine state={state} />
      {pending && !state.error && !state.ok && <p className="text-[12.5px] text-muted">Saving…</p>}
    </div>
  );
}

function PrefRow({
  label,
  emailChecked,
  smsChecked,
  disabled,
  onToggleEmail,
  onToggleSms,
}: {
  label: string;
  emailChecked: boolean;
  smsChecked: boolean;
  disabled: boolean;
  onToggleEmail: () => void;
  onToggleSms: () => void;
}) {
  return (
    <div className="flex items-stretch gap-4 rounded-[18px] bg-white/[0.06] px-5 py-4">
      <div className="min-w-0 flex-1 pr-1">
        <p className="text-[14px] font-medium text-ink">{label}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 self-center">
        <ChannelCheckbox
          label="Email"
          checked={emailChecked}
          disabled={disabled}
          onChange={onToggleEmail}
        />
        <ChannelCheckbox
          label="SMS"
          checked={smsChecked}
          disabled={disabled}
          onChange={onToggleSms}
        />
      </div>
    </div>
  );
}

function ChannelCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex w-12 cursor-pointer flex-col items-center justify-center gap-1.5 text-[12px] text-muted">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="h-5 w-5 shrink-0 rounded-[5px] accent-[#6ee1ff]"
      />
      <span className="leading-none">{label}</span>
    </label>
  );
}

function SupportForm({ profile }: { profile: BetaSignupProfile | null }) {
  const [state, action, pending] = useActionState(submitBetaSupportAction, {} as BetaActionState);
  const [email, setEmail] = useState(profile?.email ?? "");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");

  const canSend =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    category !== "" &&
    message.trim().length >= 10;

  if (state.ok) {
    return (
      <p className="text-[14px] leading-relaxed text-[#6ee1ff]">
        {state.message ?? "We'll get back to you within 2 business days."}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="help-email">
        <input
          id="help-email"
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@email.com"
          autoComplete="email"
          className={FIELD_CLASS}
        />
      </Field>

      <Field label="Category" htmlFor="help-category">
        <select
          id="help-category"
          name="category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${FIELD_CLASS} appearance-none`}
        >
          <option value="" disabled className="bg-card text-muted">
            Choose one
          </option>
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value} className="bg-card text-ink">
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Message" htmlFor="help-message">
        <textarea
          id="help-message"
          name="message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's going on?"
          className={`${FIELD_CLASS} resize-none`}
        />
      </Field>

      {state.error && (
        <p role="alert" className="text-[13.5px] text-urgency">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending || !canSend} className={`mt-2 ${BUTTON_CLASS}`}>
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

/** Dev-only: forget this browser's member so the join flow runs again. */
function DevReset() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await resetBetaSignupAction();
            if (result.error) {
              setError(result.error);
              return;
            }
            router.replace("/");
            router.refresh();
          });
        }}
        className="text-[12px] font-semibold text-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-ink disabled:opacity-60"
      >
        {pending ? "Resetting…" : "Back to start (dev)"}
      </button>
      {error && <span className="text-[12px] text-urgency">{error}</span>}
    </div>
  );
}

function StatusLine({ state }: { state: BetaActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-[13.5px] text-urgency">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="text-[13.5px] text-[#6ee1ff]">
        {state.message}
      </p>
    );
  }
  return null;
}

function splitPhone(e164: string): { country: string; national: string } {
  const digits = e164.replace(/\D/g, "");
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial) && digits.length > c.dial.length) {
      if (c.dial === "1") return { country: "CA", national: digits.slice(1) };
      return { country: c.iso2, national: digits.slice(c.dial.length) };
    }
  }
  return { country: DEFAULT_COUNTRY_ISO2, national: digits };
}
