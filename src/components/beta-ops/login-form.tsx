"use client";

import { useActionState } from "react";
import { betaOpsLoginAction, type OpsLoginState } from "@/domains/beta-ops/actions";
import { BUTTON_CLASS, FIELD_CLASS } from "@/components/beta-waitlist/field-styles";
import { Field } from "@/components/beta-waitlist/field";
import { Starfield } from "@/components/beta-waitlist/starfield";

const initial: OpsLoginState = {};

export function OpsLoginForm() {
  const [state, formAction, pending] = useActionState(betaOpsLoginAction, initial);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Starfield />
      <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
      <h1 className="headline mt-4 text-[30px] leading-tight">Ops</h1>
      <p className="mt-2 text-[14px] text-muted">Sign in to manage waitlists and sellers.</p>

      <form action={formAction} className="relative mt-8 flex flex-col gap-4">
        <Field label="Email" htmlFor="ops-email">
          <input
            id="ops-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="you@email.com"
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Password" htmlFor="ops-password">
          <input
            id="ops-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={FIELD_CLASS}
          />
        </Field>
        {state.error && (
          <p role="alert" className="text-[13.5px] text-urgency">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className={BUTTON_CLASS}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-[12px] text-muted">Session stays for 30 days on this browser.</p>
    </div>
  );
}
