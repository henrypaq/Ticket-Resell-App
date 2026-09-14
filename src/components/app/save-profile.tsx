"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfileAction, type BetaActionState } from "@/domains/beta-signup/actions";
import { DEFAULT_COUNTRY_ISO2, countryByIso2, COUNTRY_CODES } from "@/lib/country-codes";
import { formatPhoneNational } from "@/lib/phone-format";
import { CountryCodeSelect } from "@/components/forms/country-code-select";
import { Field } from "@/components/forms/field";
import { BUTTON_CLASS, FIELD_CLASS, FIELD_GROUP_CLASS } from "@/components/forms/field-styles";

export type ProfilePrefill = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** The flow they just finished, saved as their stated intent. */
  intent?: "buy" | "sell" | null;
  /** Event they just acted on — context only, never a queue seat. */
  eventName?: string | null;
  /** Link they arrived on, recorded as referral source. */
  referralSource?: string | null;
};

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

/**
 * Offered after a buy/sell flow, never before one. Everything we already know
 * is prefilled from what they typed during the flow, so the ask is usually
 * just a name and an email.
 *
 * Saving is genuinely optional: the contact cookie already carries their
 * details on this device. What a profile buys them is the same history on a
 * second device, and alerts by email.
 */
export function SaveProfileCard({
  prefill,
  heading = "Save your profile?",
  blurb = "So your tickets and waitlist spots follow you to your other devices — and we can reach you when there's a match.",
  onSaved,
}: {
  prefill: ProfilePrefill;
  heading?: string;
  blurb?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const savedPhone = splitPhone(prefill.phone);
  const [name, setName] = useState(prefill.name ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [country, setCountry] = useState(savedPhone.iso2);
  const [national, setNational] = useState(savedPhone.national);
  const [notifyOptIn, setNotifyOptIn] = useState(false);
  const [state, formAction, pending] = useActionState(saveProfileAction, {} as BetaActionState);

  const dial = countryByIso2(country).dial;
  const digits = national.replace(/\D/g, "");
  const composedPhone = digits ? `+${dial}${digits}` : "";
  const canSave =
    name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !pending;

  if (state.ok) {
    return (
      <section className="rounded-[20px] border border-[#6ee1ff]/30 bg-[#6ee1ff]/[0.07] px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6ee1ff]/25 text-[14px] font-bold text-[#6ee1ff]">
            ✓
          </span>
          <p className="text-[15px] font-bold text-ink">Profile saved</p>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{state.message}</p>
        <button
          type="button"
          onClick={() => {
            router.refresh();
            onSaved?.();
          }}
          className="mt-4 rounded-[10px] bg-white/10 px-4 py-2 text-[13px] font-semibold text-ink hover:bg-white/15"
        >
          Done
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-[20px] border border-[#ffe500]/25 bg-[#ffe500]/[0.06] px-5 py-5">
      <h2 className="headline text-[20px] uppercase leading-[1.15] tracking-tight text-ink">
        {heading}
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{blurb}</p>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="phone" value={composedPhone} />
        <input type="hidden" name="intent" value={prefill.intent ?? ""} />
        <input type="hidden" name="eventName" value={prefill.eventName ?? ""} />
        <input type="hidden" name="referralSource" value={prefill.referralSource ?? ""} />

        <Field label="Full name" htmlFor="save-name">
          <input
            id="save-name"
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

        <Field label="Email" htmlFor="save-email">
          <input
            id="save-email"
            type="email"
            name="email"
            required
            placeholder="jane@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            className={FIELD_CLASS}
          />
        </Field>
        <p className="-mt-1 text-[12px] leading-relaxed text-muted">
          Already joined before? Use the same email and we&apos;ll link this device back to you.
        </p>

        <Field label="Phone number (optional)" htmlFor="save-phone">
          <div className={FIELD_GROUP_CLASS}>
            <CountryCodeSelect
              value={country}
              onChange={setCountry}
              className="border-r border-white/10"
            />
            <input
              id="save-phone"
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
          identical to /sms-opt-in, which is the screenshot we submitted.
          Don't reword either one alone.
        */}
        <label className="mt-1 flex cursor-pointer items-start gap-3 rounded-2xl border border-hairline bg-card px-5 py-4">
          <input
            type="checkbox"
            name="notifyOptIn"
            checked={notifyOptIn}
            onChange={(e) => setNotifyOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#6ee1ff]"
          />
          <span className="text-[14px] leading-relaxed text-ink">
            Yes, text me with ticket availability and checkout updates
          </span>
        </label>
        <p className="text-[12px] leading-relaxed text-muted">
          Message frequency varies. Reply STOP to opt out, HELP for help. Msg &amp; data rates may
          apply.
        </p>

        {state.error && (
          <p role="alert" className="text-[13px] text-urgency">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={!canSave} className={`mt-1 ${BUTTON_CLASS}`}>
          {pending ? "Saving…" : "Save my profile"}
        </button>
      </form>
    </section>
  );
}
