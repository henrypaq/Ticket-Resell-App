"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addMemberAction, type OpsActionState } from "@/domains/beta-ops/actions";
import type { ClassicMemberRow } from "@/domains/beta-ops/shared";
import {
  ACQUISITION_CHANNELS,
  ACQUISITION_CHANNEL_LABELS,
} from "@/lib/beta-acquisition";
import { BUTTON_CLASS, FIELD_CLASS } from "@/components/beta-waitlist/field-styles";
import { Field } from "@/components/beta-waitlist/field";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function sourceLabel(channel: string | null) {
  if (!channel) return "Unknown";
  if (channel in ACQUISITION_CHANNEL_LABELS) {
    return ACQUISITION_CHANNEL_LABELS[channel as keyof typeof ACQUISITION_CHANNEL_LABELS];
  }
  return channel;
}

export function MemberCard({ member }: { member: ClassicMemberRow }) {
  return (
    <article className="rounded-[18px] border border-hairline bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">{member.name}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{formatWhen(member.createdAt)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#ffe500]/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#ffe500]">
          {sourceLabel(member.acquisitionChannel)}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-[13.5px]">
        <Row label="Email" value={member.email} href={`mailto:${member.email}`} />
        <Row label="Phone" value={member.phone || null} />
        <Row label="Intent" value={member.intent} />
        <Row label="Heard via" value={member.referralSource} />
        <Row
          label="Interests"
          value={
            member.interestedEvents.length
              ? member.interestedEvents.join(", ")
              : null
          }
        />
        {member.school && <Row label="School" value={member.school} />}
      </dl>

      {member.interests.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 border-t border-hairline pt-3">
          {member.interests.map((i) => (
            <li key={`${i.eventSlug}-${i.intent}`} className="text-[13px] text-muted">
              <span className="font-semibold text-ink">
                {i.intent === "waitlist" ? "Waitlist" : "Sell"} · {i.eventName}
              </span>
              {i.contactPhone ? ` · ${i.contactPhone}` : ""}
              {i.contactInstagram ? ` · @${i.contactInstagram}` : ""}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Row({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-all font-medium text-ink">
        {href ? (
          <a href={href} className="underline decoration-dotted underline-offset-2">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

const initial: OpsActionState = {};

export function AddMemberForm({ heading }: { heading?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addMemberAction, initial);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      setOpen(false);
    }
  }, [state.ok, router]);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{heading}</div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] font-semibold text-muted hover:text-ink"
        >
          {open ? "Close" : "Add member"}
        </button>
      </div>

      {open && (
        <form
          action={formAction}
          className="mt-4 flex flex-col gap-3 rounded-[18px] border border-hairline bg-white/[0.04] p-4"
        >
          <p className="text-[14px] font-semibold text-ink">New member</p>
          <Field label="Name" htmlFor="add-name">
            <input id="add-name" name="name" required className={FIELD_CLASS} placeholder="Jane Doe" />
          </Field>
          <Field label="Email" htmlFor="add-email">
            <input
              id="add-email"
              name="email"
              type="email"
              required
              className={FIELD_CLASS}
              placeholder="jane@email.com"
            />
          </Field>
          <Field label="Phone (optional)" htmlFor="add-phone">
            <input id="add-phone" name="phone" type="tel" className={FIELD_CLASS} placeholder="+1514…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Intent" htmlFor="add-intent">
              <select id="add-intent" name="intent" defaultValue="both" className={FIELD_CLASS}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="both">Both</option>
              </select>
            </Field>
            <Field label="Source" htmlFor="add-source">
              <select
                id="add-source"
                name="acquisitionChannel"
                defaultValue="manual"
                className={FIELD_CLASS}
              >
                {ACQUISITION_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {ACQUISITION_CHANNEL_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Referral note (optional)" htmlFor="add-referral">
            <input
              id="add-referral"
              name="referralSource"
              className={FIELD_CLASS}
              placeholder="e.g. Gaspar’s friend"
            />
          </Field>
          <Field label="Internal notes (optional)" htmlFor="add-notes">
            <input
              id="add-notes"
              name="notes"
              className={FIELD_CLASS}
              placeholder="Context for the team"
            />
          </Field>
          {state.error && (
            <p role="alert" className="text-[13px] text-urgency">
              {state.error}
            </p>
          )}
          <button type="submit" disabled={pending} className={BUTTON_CLASS}>
            {pending ? "Adding…" : "Add to list"}
          </button>
        </form>
      )}
    </div>
  );
}
