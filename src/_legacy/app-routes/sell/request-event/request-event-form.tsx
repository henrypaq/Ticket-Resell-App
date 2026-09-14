"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  autofillFromUrlAction,
  requestEventAction,
  type RequestEventFormState,
} from "@/domains/events/actions";
import { ShieldIcon } from "@/components/icons";

const initial: RequestEventFormState = {};
const EMPTY_FIELDS = { name: "", venue: "", city: "Montreal", startsAt: "", originalPrice: "" };

export function RequestEventForm() {
  const [autofillState, autofillAction, autofilling] = useActionState(
    autofillFromUrlAction,
    initial,
  );
  const [submitState, submitAction, submitting] = useActionState(requestEventAction, initial);

  const [sourceUrl, setSourceUrl] = useState("");
  const [manualEdits, setManualEdits] = useState<Partial<typeof EMPTY_FIELDS>>({});

  // Fields render from the latest autofill result overlaid with whatever the
  // user has typed since — no effect needed, this derives directly from state
  // available during render (autofillState only changes on a real action run).
  const autofilled = autofillState.parsed?.parsed ?? false;
  const fields = useMemo(() => {
    const p = autofillState.parsed;
    const base = {
      ...EMPTY_FIELDS,
      ...(p
        ? {
            name: p.name ?? "",
            venue: p.venue ?? "",
            startsAt: p.startsAt ? toLocalInputValue(p.startsAt) : "",
            originalPrice: p.originalPrice !== undefined ? String(p.originalPrice) : "",
          }
        : {}),
    };
    return { ...base, ...manualEdits };
  }, [autofillState.parsed, manualEdits]);

  function setField(key: keyof typeof EMPTY_FIELDS, value: string) {
    setManualEdits((prev) => ({ ...prev, [key]: value }));
  }

  if (submitState.success) {
    return (
      <div className="surface rounded-2xl px-5 py-8 text-center">
        <ShieldIcon className="mx-auto h-6 w-6 text-muted" />
        <p className="mt-4 text-[15px] font-medium">Sent for review</p>
        <Link
          href="/sell"
          className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-[14px] font-bold text-base"
        >
          Back to posting
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={autofillAction} className="space-y-3">
        <label htmlFor="sourceUrl" className="block text-[13px] font-medium text-muted">
          Event link (optional)
        </label>
        <div className="flex gap-2">
          <input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.eventbrite.com/e/..."
            className="pill flex-1 px-5 py-3.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-white/25"
          />
          <button
            type="submit"
            disabled={autofilling || !sourceUrl}
            className="shrink-0 rounded-full border border-hairline px-4 py-3.5 text-[14px] font-semibold disabled:opacity-50"
          >
            {autofilling ? "Reading…" : "Autofill"}
          </button>
        </div>
        {autofillState.error && (
          <p className="text-[12.5px] text-urgency">{autofillState.error}</p>
        )}
        {autofillState.parsed && (
          <p className="text-[12.5px] text-muted">{autofillState.parsed.note}</p>
        )}
      </form>

      <form action={submitAction} className="space-y-4 border-t border-hairline pt-6">
        <input type="hidden" name="sourceUrl" value={sourceUrl} />
        <input type="hidden" name="autofilled" value={String(autofilled)} />

        <Field label="Event name">
          <input
            name="name"
            required
            minLength={2}
            value={fields.name}
            onChange={(e) => setField("name", e.target.value)}
            className="pill w-full px-5 py-3.5 text-[16px] text-ink outline-none placeholder:text-muted focus:border-white/25"
          />
        </Field>

        <Field label="Venue">
          <input
            name="venue"
            required
            minLength={2}
            value={fields.venue}
            onChange={(e) => setField("venue", e.target.value)}
            className="pill w-full px-5 py-3.5 text-[16px] text-ink outline-none placeholder:text-muted focus:border-white/25"
          />
        </Field>

        <Field label="City">
          <input
            name="city"
            required
            value={fields.city}
            onChange={(e) => setField("city", e.target.value)}
            className="pill w-full px-5 py-3.5 text-[16px] text-ink outline-none placeholder:text-muted focus:border-white/25"
          />
        </Field>

        <Field label="Date and time">
          <input
            name="startsAt"
            type="datetime-local"
            required
            value={fields.startsAt}
            onChange={(e) => setField("startsAt", e.target.value)}
            className="pill w-full px-5 py-3.5 text-[16px] text-ink outline-none focus:border-white/25"
          />
        </Field>

        <Field label="Original ticket price (CAD)">
          <input
            name="originalPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            value={fields.originalPrice}
            onChange={(e) => setField("originalPrice", e.target.value)}
            className="pill w-full px-5 py-3.5 text-[16px] text-ink outline-none placeholder:text-muted focus:border-white/25"
          />
        </Field>

        {submitState.error && (
          <p role="alert" className="rounded-2xl border border-urgency/30 bg-urgency/10 px-4 py-3 text-[13.5px] text-urgency">
            {submitState.error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-ink px-5 py-4 text-[15px] font-bold text-base disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send for review"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-muted">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
