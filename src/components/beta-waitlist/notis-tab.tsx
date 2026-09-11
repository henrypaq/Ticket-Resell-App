"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resumeBetaSignupByEmailAction,
  updateBetaContactAction,
  updateBetaNotificationPrefsAction,
  type BetaActionState,
} from "@/domains/beta-signup/actions";
import type { BetaSignupProfile } from "@/domains/beta-signup/shared";
import { COUNTRY_CODES, DEFAULT_COUNTRY_ISO2, countryByIso2 } from "@/lib/country-codes";
import { formatPhoneNational } from "@/lib/phone-format";
import { CountryCodeSelect } from "./country-code-select";
import { Field } from "./field";
import { BUTTON_CLASS, BUTTON_CLASS_COMPACT, FIELD_CLASS, FIELD_GROUP_CLASS } from "./field-styles";

type Props = {
  profile: BetaSignupProfile | null;
};

type PrefKey =
  | "notifyQueueEmail"
  | "notifyQueueSms"
  | "notifyTicketsEmail"
  | "notifyTicketsSms";

type Prefs = Record<PrefKey, boolean>;

/**
 * Notis tab — contact fields up top, alert channels (email/SMS per alert
 * type) below. Channel toggles auto-save on click; contact still needs Save
 * because mid-typing shouldn't hit the DB.
 */
export function BetaNotisTab({ profile }: Props) {
  if (!profile) {
    return <ResumeProfileCard />;
  }

  return (
    <div className="flex flex-col gap-10">
      <ContactForm profile={profile} />

      <div>
        <p className="section-header mb-3 text-[12px] text-muted">Alerts</p>
        <PrefsForm profile={profile} />
      </div>
    </div>
  );
}

/** Recover prefs when the signup cookie is missing/stale (other device, cleared cookies). */
function ResumeProfileCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOk || pending) return;
    setError(null);
    start(async () => {
      const result = await resumeBetaSignupByEmailAction(email.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.resumed) {
        setError("No beta member found for that email. Sign up from Events, or try another email.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] leading-relaxed text-muted">
        Enter the email you used as a beta member to restore notification preferences on this
        device.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Email" htmlFor="resume-email">
          <input
            id="resume-email"
            type="email"
            required
            placeholder="jane@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={FIELD_CLASS}
          />
        </Field>
        {error && (
          <p role="alert" className="text-[13.5px] text-urgency">
            {error}
          </p>
        )}
        <button type="submit" disabled={!emailOk || pending} className={BUTTON_CLASS}>
          {pending ? "Looking up…" : "Restore my preferences"}
        </button>
      </form>
    </div>
  );
}

function ContactForm({ profile }: { profile: BetaSignupProfile }) {
  const parsed = splitPhone(profile.phone);
  const initialDigits = profile.phone.replace(/\D/g, "");
  const initialPhone = initialDigits ? `+${initialDigits}` : "";

  const [email, setEmail] = useState(profile.email);
  const [country, setCountry] = useState(parsed.country);
  const [national, setNational] = useState(parsed.national);
  const [savedEmail, setSavedEmail] = useState(profile.email.trim().toLowerCase());
  const [savedPhone, setSavedPhone] = useState(initialPhone);
  const [state, setState] = useState<BetaActionState>({});
  const [pending, startTransition] = useTransition();

  const dial = countryByIso2(country).dial;
  const digits = national.replace(/\D/g, "");
  const composedPhone = digits ? `+${dial}${digits}` : "";
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const dirty =
    email.trim().toLowerCase() !== savedEmail || composedPhone !== savedPhone;
  const canSave = emailValid && dirty && !pending;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;
    const fd = new FormData(e.currentTarget);
    setState({});
    startTransition(async () => {
      const result = await updateBetaContactAction({}, fd);
      setState(result);
      if (result.ok) {
        setSavedEmail(email.trim().toLowerCase());
        setSavedPhone(composedPhone);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field label="Email" htmlFor="notis-email">
        <input
          id="notis-email"
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
      <Field label="Phone number (optional)" htmlFor="notis-phone">
        <div className={FIELD_GROUP_CLASS}>
          <CountryCodeSelect value={country} onChange={setCountry} className="border-r border-white/10" />
          <input
            id="notis-phone"
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
      <StatusLine state={state} />
      <button type="submit" disabled={!canSave} className={`mt-3 ${BUTTON_CLASS_COMPACT}`}>
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
        description="Be notified when it's your turn to checkout for the ticket you requested"
        emailChecked={prefs.notifyQueueEmail}
        smsChecked={prefs.notifyQueueSms}
        disabled={pending}
        onToggleEmail={() => toggle("notifyQueueEmail")}
        onToggleSms={() => toggle("notifyQueueSms")}
      />
      <PrefRow
        label="Available tickets"
        description="Be notified of extra tickets for events you like"
        emailChecked={prefs.notifyTicketsEmail}
        smsChecked={prefs.notifyTicketsSms}
        disabled={pending}
        onToggleEmail={() => toggle("notifyTicketsEmail")}
        onToggleSms={() => toggle("notifyTicketsSms")}
      />

      <StatusLine state={state} />
      {pending && !state.error && !state.ok && (
        <p className="text-[12.5px] text-muted">Saving…</p>
      )}
    </div>
  );
}

function PrefRow({
  label,
  description,
  emailChecked,
  smsChecked,
  disabled,
  onToggleEmail,
  onToggleSms,
}: {
  label: string;
  description: string;
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
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{description}</p>
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
      if (c.dial === "1") {
        return { country: "CA", national: digits.slice(1) };
      }
      return { country: c.iso2, national: digits.slice(c.dial.length) };
    }
  }
  return { country: DEFAULT_COUNTRY_ISO2, national: digits };
}
