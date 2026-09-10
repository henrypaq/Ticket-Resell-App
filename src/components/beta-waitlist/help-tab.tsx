"use client";

import { useActionState, useState } from "react";
import {
  submitBetaSupportAction,
  type BetaActionState,
} from "@/domains/beta-signup/actions";
import { SUPPORT_CATEGORIES, type BetaSignupProfile } from "@/domains/beta-signup/shared";
import { Field } from "./field";
import { BUTTON_CLASS, FIELD_CLASS } from "./field-styles";

type Props = {
  profile: BetaSignupProfile | null;
};

const initial: BetaActionState = {};

/** Help / Contact tab — support form persisted to `beta_support_messages`. */
export function BetaHelpTab({ profile }: Props) {
  const [state, action, pending] = useActionState(submitBetaSupportAction, initial);
  const [email, setEmail] = useState(profile?.email ?? "");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");

  const canSend =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    category !== "" &&
    message.trim().length >= 10;

  return (
    <div className="flex flex-col gap-6">
      {state.ok ? (
        <p className="text-[14px] leading-relaxed text-[#6ee1ff]">
          {state.message ?? "We'll get back to you within 2 business days."}
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <p className="text-[13px] text-muted">
            Send us your questions, requests, and concerns. We&apos;ll get back to you asap!
          </p>
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

          <button
            type="submit"
            disabled={pending || !canSend}
            className={`mt-2 ${BUTTON_CLASS}`}
          >
            {pending ? "Sending…" : "Send message"}
          </button>
        </form>
      )}
    </div>
  );
}
