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
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
}: {
  tonight: OpsWaitlistEntry[];
  previous: OpsWaitlistEntry[];
  offers: BuyerOfferRow[];
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
        <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
          Waitlist people — tap one to see holds and payment status. Event queues live under
          Events.
        </p>
      </div>

      <DayDrawer
        title="Tonight"
        summary={`${tonight.length} buyer${tonight.length === 1 ? "" : "s"}`}
        defaultOpen
      >
        {tonight.length === 0 ? (
          <p className="text-xs text-zinc-500">No active buyers for tonight.</p>
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

  return (
    <li className="rounded-lg bg-zinc-950/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left focus:outline-none"
        aria-expanded={open}
      >
        <span className="w-7 shrink-0 text-[11px] font-semibold tabular-nums text-zinc-500">
          #{entry.displayedPosition}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[12px] font-medium text-zinc-200">{label}</span>
            <Badge variant="subtle" className="px-1.5 py-0 text-[9px]">
              ×{entry.quantity}
            </Badge>
            {liveOffers.length > 0 && (
              <Badge variant="accent" className="px-1.5 py-0 text-[9px]">
                {liveOffers[0]!.status}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-[10px] text-zinc-500">
            {entry.eventName} · {entry.source}
            {entry.status !== "classic" ? ` · ${entry.status}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-zinc-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-zinc-800/60 px-3 pb-2.5 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Contact
              </a>
            )}
            {entry.email && <span className="truncate">{entry.email}</span>}
            <OpsDeleteButton
              confirmMessage={`Remove ${label} from ${entry.eventName}?`}
              onConfirm={() => deleteWaitlistEntryAction(entry.source, entry.id)}
            />
          </div>

          {entry.goLead && (
            <div className="flex flex-wrap gap-1">
              {LEAD_STATUSES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={entry.status === s ? "default" : "outline"}
                  disabled={pending}
                  className="h-6 px-2 text-[10px] uppercase"
                  onClick={() => setStatus(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}

          {offers.length === 0 ? (
            <p className="text-[10px] text-zinc-600">No exclusive offers yet for this seat.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {offers.map((o) => (
                <li
                  key={o.id}
                  className="rounded-md bg-zinc-900/70 px-2 py-1.5 text-[11px] text-zinc-300"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {o.status}
                    </Badge>
                    <span>
                      rank {o.rank} · ${Number(o.price_each).toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                    exp {new Date(o.expires_at).toLocaleString()}
                    {o.buyer_declared_sent_at ? " · says sent" : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {o.status === "offered" && (
                      <>
                        <MiniAction label="Accept" onClick={() => acceptOfferAction(o.id)} />
                        <MiniAction
                          label="Pass"
                          onClick={() => declineOfferAction(o.id, "price")}
                        />
                      </>
                    )}
                    {(o.status === "accepted" || o.status === "offered") && (
                      <MarkPaidMini offerId={o.id} amount={Number(o.price_each)} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
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
      className="h-6 px-2 text-[10px]"
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
      className="h-6 px-2 text-[10px]"
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
