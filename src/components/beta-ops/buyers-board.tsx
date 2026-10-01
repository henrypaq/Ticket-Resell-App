"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  acceptOfferAction,
  declineOfferAction,
  deleteWaitlistEntryAction,
  markOfferPaidAction,
  updateLeadStatusAction,
} from "@/domains/beta-ops/actions";
import {
  LEAD_STATUSES,
  type LeadStatus,
  type OpsWaitlistEntry,
} from "@/domains/beta-ops/shared";
import { formatNightStamp } from "@/lib/beta-events";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";
import { Button } from "@/components/ui/button";

export type BuyerOfferRow = {
  id: string;
  unit_id: string;
  buy_lead_id: string | null;
  classic_interest_id: string | null;
  seat_key: string;
  event_slug: string;
  rank: number;
  price_each: number;
  status: string;
  offered_at: string;
  expires_at: string;
  payment_due_at: string | null;
  buyer_declared_sent_at?: string | null;
};

/**
 * Person-centric buyers inbox — tonight vs previous, expand for offers.
 * Complements Events (event → waitlist) with buyer → offers.
 */
export function BuyersBoard({
  tonight,
  previous,
  offers,
  tonightLabel,
}: {
  tonight: OpsWaitlistEntry[];
  previous: OpsWaitlistEntry[];
  offers: BuyerOfferRow[];
  tonightLabel: string;
}) {
  const offersByBuyer = new Map<string, BuyerOfferRow[]>();
  for (const o of offers) {
    const key = o.buy_lead_id
      ? `go:${o.buy_lead_id}`
      : o.classic_interest_id
        ? `classic:${o.classic_interest_id}`
        : null;
    if (!key) continue;
    const list = offersByBuyer.get(key) ?? [];
    list.push(o);
    offersByBuyer.set(key, list);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Buyers</h1>
      </div>

      <DayDrawer
        title={`Tonight · ${tonightLabel}`}
        summary={`${tonight.length} buyer${tonight.length === 1 ? "" : "s"}`}
        defaultOpen
      >
        {tonight.length === 0 ? (
          <p className="text-xs text-zinc-500">None</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tonight.map((entry) => (
              <BuyerRow
                key={`${entry.source}-${entry.id}`}
                entry={entry}
                offers={offersByBuyer.get(`${entry.source}:${entry.id}`) ?? []}
              />
            ))}
          </ul>
        )}
      </DayDrawer>

      <DayDrawer
        title="Previous days"
        summary={`${previous.length} buyer${previous.length === 1 ? "" : "s"}`}
        defaultOpen={false}
      >
        {previous.length === 0 ? (
          <p className="text-xs text-zinc-500">No buyers from previous days.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {previous.map((entry) => (
              <BuyerRow
                key={`${entry.source}-${entry.id}`}
                entry={entry}
                offers={offersByBuyer.get(`${entry.source}:${entry.id}`) ?? []}
              />
            ))}
          </ul>
        )}
      </DayDrawer>
    </div>
  );
}

function DayDrawer({
  title,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl bg-zinc-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left focus:outline-none"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100">{title}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">{summary}</p>
        </div>
        <span className="shrink-0 text-zinc-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && <div className="border-t border-zinc-800/80 px-3 pb-3 pt-2">{children}</div>}
    </section>
  );
}

function BuyerRow({
  entry,
  offers,
}: {
  entry: OpsWaitlistEntry;
  offers: BuyerOfferRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const label = contactLabel(entry);
  const href = contactHref(entry);
  const liveOffers = offers.filter((o) =>
    ["offered", "accepted", "paid", "needs_review"].includes(o.status),
  );

  function setStatus(status: LeadStatus) {
    if (!entry.goLead) return;
    start(async () => {
      await updateLeadStatusAction(entry.goLead!.id, status);
      router.refresh();
    });
  }

  const matched = liveOffers.length > 0;
  const headline = liveOffers[0];

  return (
    <li
      className={`overflow-hidden rounded-xl ${
        matched
          ? "bg-amber-400/[0.08] ring-1 ring-amber-300/50"
          : "bg-zinc-950/50 ring-1 ring-white/[0.04]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left focus:outline-none"
        aria-expanded={open}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-ui text-[15px] font-bold tabular-nums ${
            matched ? "bg-amber-300 text-zinc-950" : "bg-zinc-900 text-zinc-400"
          }`}
        >
          {entry.displayedPosition}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-zinc-100">{label}</span>
            <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-300">
              ×{entry.quantity}
            </span>
            {headline && <OfferPill status={headline.status} />}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-zinc-400">
            {entry.eventName}
            <span className="text-zinc-600"> · </span>
            {formatNightStamp(entry.createdAt)}
          </p>
        </div>
        <span className="shrink-0 text-zinc-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/[0.06] px-3 pb-3 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-300">
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-zinc-100 px-3 py-1 text-[12px] font-semibold text-zinc-950"
                onClick={(e) => e.stopPropagation()}
              >
                Contact
              </a>
            )}
            {entry.email && <span className="truncate text-zinc-400">{entry.email}</span>}
            <OpsDeleteButton
              confirmMessage={`Remove ${label} from ${entry.eventName}?`}
              onConfirm={() => deleteWaitlistEntryAction(entry.source, entry.id)}
            />
          </div>

          {entry.goLead && (
            <div className="grid grid-cols-5 gap-1">
              {LEAD_STATUSES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={entry.status === s ? "default" : "outline"}
                  disabled={pending}
                  className={`h-8 px-1 text-[10px] capitalize ${
                    entry.status === s ? "bg-zinc-100 text-zinc-950" : "text-zinc-400"
                  }`}
                  onClick={() => setStatus(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}

          {offers.length > 0 && (
            <ul className="flex flex-col gap-2">
              {offers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function OfferCard({ offer }: { offer: BuyerOfferRow }) {
  const price = Number(offer.price_each);
  const tone = offerTone(offer.status);
  return (
    <li className={`rounded-xl px-3.5 py-3 ${tone}`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <OfferPill status={offer.status} />
          <p className="font-ui mt-1 text-[32px] font-bold leading-none tabular-nums text-zinc-50">
            ${Number.isFinite(price) ? price.toFixed(0) : "—"}
          </p>
        </div>
        <p className="pb-1 text-right text-[12px] text-zinc-300">
          {shortWhen(offer.expires_at)}
          {offer.buyer_declared_sent_at ? " · sent" : ""}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {offer.status === "offered" && (
          <>
            <MiniAction label="Accept" onClick={() => acceptOfferAction(offer.id)} />
            <MiniAction label="Pass" onClick={() => declineOfferAction(offer.id, "price")} />
          </>
        )}
        {(offer.status === "accepted" || offer.status === "offered") && (
          <MarkPaidMini offerId={offer.id} amount={price} />
        )}
      </div>
    </li>
  );
}

function OfferPill({ status }: { status: string }) {
  const live = status === "offered" || status === "accepted" || status === "paid";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        status === "paid"
          ? "bg-emerald-400 text-zinc-950"
          : live
            ? "bg-amber-300 text-zinc-950"
            : "bg-zinc-800 text-zinc-300"
      }`}
    >
      {offerLabel(status)}
    </span>
  );
}

function offerLabel(status: string) {
  if (status === "needs_review") return "Review";
  if (status === "expired_no_response" || status === "expired_unpaid") return "Expired";
  if (status === "payment_failed") return "Failed";
  return status.replace(/_/g, " ");
}

function offerTone(status: string) {
  if (status === "paid") return "bg-emerald-400/10 ring-1 ring-emerald-300/40";
  if (status === "offered" || status === "accepted") return "bg-amber-300/10 ring-1 ring-amber-300/35";
  if (status === "needs_review") return "bg-sky-400/10 ring-1 ring-sky-300/30";
  return "bg-zinc-900/80 ring-1 ring-white/[0.04]";
}

function shortWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function contactLabel(entry: OpsWaitlistEntry) {
  if (entry.name) return entry.name;
  if (entry.contactInstagram) return `@${entry.contactInstagram}`;
  if (entry.contactPhone) return entry.contactPhone;
  if (entry.email) return entry.email;
  return "Anonymous";
}

function contactHref(entry: OpsWaitlistEntry) {
  if (entry.contactPhone) {
    return `https://wa.me/${entry.contactPhone.replace(/\D/g, "")}`;
  }
  if (entry.contactInstagram) {
    return `https://instagram.com/${entry.contactInstagram}`;
  }
  if (entry.email) return `mailto:${entry.email}`;
  return null;
}

function MiniAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => Promise<{ ok?: true; error?: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      className="h-9 rounded-lg px-3 text-[13px] font-semibold"
      onClick={() => {
        start(async () => {
          const r = await onClick();
          if (r.error) window.alert(r.error);
          router.refresh();
        });
      }}
    >
      {pending ? "…" : label}
    </Button>
  );
}

function MarkPaidMini({ offerId, amount }: { offerId: string; amount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      className="h-9 rounded-lg px-3 text-[13px] font-semibold"
      onClick={() => {
        const raw = window.prompt("E-transfer amount (CAD)", String(amount));
        if (raw === null) return;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          window.alert("Enter a valid amount.");
          return;
        }
        start(async () => {
          const r = await markOfferPaidAction(offerId, { amount: value });
          if (r.error) window.alert(r.error);
          router.refresh();
        });
      }}
    >
      {pending ? "…" : "Mark paid"}
    </Button>
  );
}
