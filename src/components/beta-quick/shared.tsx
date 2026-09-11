"use client";

import type { BetaEvent } from "@/lib/beta-events";
import { DEFAULT_COUNTRY_ISO2, countryByIso2 } from "@/lib/country-codes";
import { formatPhoneNational } from "@/lib/phone-format";
import { CountryCodeSelect } from "@/components/beta-waitlist/country-code-select";
import { Field } from "@/components/beta-waitlist/field";
import { FIELD_CLASS, FIELD_GROUP_CLASS } from "@/components/beta-waitlist/field-styles";

export function StepHeading({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="section-header text-[11px] text-muted">{eyebrow}</p>
      <h1 className="headline mt-2 text-[28px] leading-[1.15] tracking-tight">{title}</h1>
      {hint && <p className="mt-2 text-[14px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

export function EventPicker({
  events,
  value,
  onChange,
}: {
  events: BetaEvent[];
  value: string;
  onChange: (slug: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {events.map((event) => {
        const selected = value === event.slug;
        return (
          <button
            key={event.slug}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(event.slug)}
            className={`flex items-center gap-3 rounded-[16px] border p-2.5 text-left transition-colors ${
              selected
                ? "border-[#ffe500]/50 bg-[#ffe500]/10"
                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
            }`}
          >
            <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-[10px] bg-[#17171a]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={event.flyerUrl} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-ink">{event.name}</span>
              <span className="mt-0.5 block text-[12.5px] text-muted">{event.venue}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max = 8,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label="Fewer"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-[22px] text-ink disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-[3ch] text-center text-[28px] font-bold tabular-nums text-ink">
        {value}
      </span>
      <button
        type="button"
        aria-label="More"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-[22px] text-ink disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

export function ContactFields({
  phoneCountry,
  phoneNational,
  instagram,
  onPhoneCountry,
  onPhoneNational,
  onInstagram,
  hint = "One is enough — we'll message you there.",
  hintAbove = false,
}: {
  phoneCountry: string;
  phoneNational: string;
  instagram: string;
  onPhoneCountry: (iso2: string) => void;
  onPhoneNational: (digits: string) => void;
  onInstagram: (handle: string) => void;
  hint?: string | null;
  hintAbove?: boolean;
}) {
  const dial = countryByIso2(phoneCountry).dial;
  const digits = phoneNational.replace(/\D/g, "");

  return (
    <div className="flex flex-col gap-3">
      {hintAbove && hint && <p className="text-[12.5px] text-muted">{hint}</p>}
      <Field label="WhatsApp / phone" htmlFor="quick-phone">
        <div className={FIELD_GROUP_CLASS}>
          <CountryCodeSelect
            value={phoneCountry}
            onChange={onPhoneCountry}
            className="border-r border-white/10"
          />
          <input
            id="quick-phone"
            type="tel"
            placeholder={dial === "1" ? "(514) 555-0123" : "Phone number"}
            value={formatPhoneNational(digits, dial)}
            onChange={(e) => onPhoneNational(e.target.value.replace(/\D/g, "").slice(0, 15))}
            inputMode="tel"
            className="min-w-0 flex-1 bg-transparent py-4 pl-3 pr-5 text-[16px] text-ink outline-none placeholder:text-muted/70"
          />
        </div>
      </Field>
      <Field label="Or Instagram" htmlFor="quick-ig">
        <div className="flex items-center rounded-[14px] bg-[#1a1a1d] px-5 focus-within:bg-[#222226]">
          <span className="text-muted">@</span>
          <input
            id="quick-ig"
            value={instagram.replace(/^@+/, "")}
            onChange={(e) => onInstagram(e.target.value.replace(/^@+/, "").slice(0, 40))}
            placeholder="yourhandle"
            autoCapitalize="off"
            autoCorrect="off"
            className="min-w-0 flex-1 bg-transparent py-4 pl-1 text-[16px] text-ink outline-none placeholder:text-muted/70"
          />
        </div>
      </Field>
      {!hintAbove && hint && (
        <p className="-mt-1 text-[12.5px] text-muted">{hint}</p>
      )}
    </div>
  );
}

export function composeQuickPhone(country: string, national: string): string {
  const digits = national.replace(/\D/g, "");
  if (!digits) return "";
  return `+${countryByIso2(country).dial}${digits}`;
}

export { DEFAULT_COUNTRY_ISO2, FIELD_CLASS };
