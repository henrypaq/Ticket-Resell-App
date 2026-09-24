"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProfilePrefillData } from "@/domains/beta-quick/shared";
import { Field } from "@/components/forms/field";
import { FIELD_CLASS } from "@/components/forms/field-styles";
import { GoogleContinueButton } from "./google-continue-button";

/**
 * Finish-your-account entry on the done screen: Google, or name + email → setup.
 */
export function AccountSetupEntry({
  intent,
  returnTo,
  setupPath,
  prefill,
  className = "",
}: {
  intent: "buy" | "sell";
  returnTo: string;
  setupPath: string;
  prefill: ProfilePrefillData;
  className?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(prefill.name ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSetup = name.trim().length > 0 && emailOk;

  function onSetupAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!canSetup) return;
    const params = new URLSearchParams({
      intent,
      next: returnTo,
      name: name.trim(),
      email: email.trim().toLowerCase(),
    });
    router.push(`/setup?${params.toString()}`);
  }

  return (
    <section
      className={`rounded-[18px] border border-white/10 bg-white/[0.03] p-5 sm:p-6 ${className}`}
    >
      <h2 className="font-ui text-[15px] font-semibold tracking-tight text-ink">
        Finish your account
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        Save your details so matches follow you across devices, and add Interac payout info for when
        you sell.
      </p>

      <div className="mt-5">
        <GoogleContinueButton nextPath={setupPath} />
      </div>

      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-white/10" />
        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          or
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={onSetupAccount} className="flex flex-col gap-3.5">
        <Field label="Name" htmlFor="done-setup-name">
          <input
            id="done-setup-name"
            name="name"
            required
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${FIELD_CLASS} !py-3.5 !text-[15px]`}
          />
        </Field>
        <Field label="Email" htmlFor="done-setup-email">
          <input
            id="done-setup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            placeholder="you@mail.mcgill.ca"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${FIELD_CLASS} !py-3.5 !text-[15px]`}
          />
        </Field>
        <button
          type="submit"
          disabled={!canSetup}
          className={`font-ui mt-1 flex min-h-[50px] w-full items-center justify-center rounded-[14px] border-0 px-8 text-[15px] font-semibold tracking-tight transition-opacity ${
            canSetup
              ? "bg-white text-[#0b0b0c] hover:opacity-90"
              : "cursor-not-allowed bg-white/25 text-black/45"
          }`}
        >
          Setup account
        </button>
      </form>
    </section>
  );
}
