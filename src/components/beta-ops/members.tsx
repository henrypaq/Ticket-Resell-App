"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addMemberAction, deleteMemberAction, type OpsActionState } from "@/domains/beta-ops/actions";
import type { ClassicMemberRow } from "@/domains/beta-ops/shared";
import {
  ACQUISITION_CHANNELS,
  ACQUISITION_CHANNEL_LABELS,
} from "@/lib/beta-acquisition";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
    <article className="rounded-xl bg-zinc-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-100">{member.name}</h2>
          <p className="mt-0.5 text-xs text-zinc-400">{formatWhen(member.createdAt)}</p>
        </div>
        <Badge variant="subtle" className="text-[10px] uppercase font-semibold">
          {sourceLabel(member.acquisitionChannel)}
        </Badge>
      </div>

      <div className="mt-2.5 flex justify-end">
        <OpsDeleteButton
          label="Delete member"
          confirmMessage={`Delete ${member.name} (${member.email}) and all their waitlist/sell interests? This cannot be undone.`}
          onConfirm={() => deleteMemberAction(member.id)}
        />
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
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
        <ul className="mt-3 flex flex-col gap-1.5 rounded-lg bg-zinc-950/40 p-2.5">
          {member.interests.map((i) => (
            <li key={`${i.eventSlug}-${i.intent}`} className="text-xs text-zinc-400">
              <span className="font-medium text-zinc-200">
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
      <dt className="w-20 shrink-0 text-zinc-400">{label}</dt>
      <dd className="min-w-0 break-all font-medium text-zinc-200">
        {href ? (
          <a href={href} className="underline decoration-dotted underline-offset-2 hover:text-zinc-100">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md text-xs"
        >
          {open ? "Close" : "Add member"}
        </Button>
      </div>

      {open && (
        <form
          action={formAction}
          className="mt-4 flex flex-col gap-3 rounded-xl bg-zinc-900/60 p-4"
        >
          <p className="text-sm font-semibold text-zinc-100">New member</p>
          <div className="space-y-1">
            <label htmlFor="add-name" className="text-xs font-medium text-zinc-300">Name</label>
            <Input id="add-name" name="name" required placeholder="Jane Doe" />
          </div>
          <div className="space-y-1">
            <label htmlFor="add-email" className="text-xs font-medium text-zinc-300">Email</label>
            <Input id="add-email" name="email" type="email" required placeholder="jane@email.com" />
          </div>
          <div className="space-y-1">
            <label htmlFor="add-phone" className="text-xs font-medium text-zinc-300">Phone (optional)</label>
            <Input id="add-phone" name="phone" type="tel" placeholder="+1514…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="add-intent" className="text-xs font-medium text-zinc-300">Intent</label>
              <select
                id="add-intent"
                name="intent"
                defaultValue="both"
                className="flex h-8 w-full rounded-md bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="add-source" className="text-xs font-medium text-zinc-300">Source</label>
              <select
                id="add-source"
                name="acquisitionChannel"
                defaultValue="manual"
                className="flex h-8 w-full rounded-md bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
              >
                {ACQUISITION_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {ACQUISITION_CHANNEL_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="add-referral" className="text-xs font-medium text-zinc-300">Referral note (optional)</label>
            <Input id="add-referral" name="referralSource" placeholder="e.g. Gaspar’s friend" />
          </div>
          <div className="space-y-1">
            <label htmlFor="add-notes" className="text-xs font-medium text-zinc-300">Internal notes (optional)</label>
            <Input id="add-notes" name="notes" placeholder="Context for the team" />
          </div>
          {state.error && (
            <p role="alert" className="text-xs text-amber-400">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="mt-1 rounded-md text-xs font-medium">
            {pending ? "Adding…" : "Add to list"}
          </Button>
        </form>
      )}
    </div>
  );
}
