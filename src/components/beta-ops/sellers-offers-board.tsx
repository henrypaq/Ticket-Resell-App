"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import {
  acceptOfferAction,
  allocateUnitAction,
  backfillSellUnitsAction,
  createUnitsForSellLeadAction,
  declineOfferAction,
  deleteLeadAction,
  markOfferNeedsReviewAction,
  markOfferPaidAction,
  markOfferPaymentFailedAction,
  markTicketForwardedAction,
  reactivateSeatAction,
  releaseSellerPayoutAction,
  releaseUnitToOpenAction,
} from "@/domains/beta-ops/actions";
import { LeadCard } from "@/components/beta-ops/lead-card";
import { OpsDeleteButton } from "@/components/beta-ops/delete-button";
import type { SellerEventEntry } from "@/components/beta-ops/sellers-board";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type OpsOfferRow = {
  id: string;
  unit_id: string;
  seat_key: string;
  event_slug: string;
  rank: number;
  price_each: number;
  status: string;
  offered_at: string;
  expires_at: string;
  payment_due_at: string | null;
  buyer_declared_sent_at?: string | null;
  ticket_transferred_at?: string | null;
  payout_released_at?: string | null;
};

export type OpsUnitRow = {
  id: string;
  sell_lead_id: string;
  event_slug: string;
  unit_index: number;
  price_each: number;
  status: string;
};

/**
 * Combined Sellers + Offers: tonight vs previous days as drawers;
 * click a seller to see their units and exclusive offers.
 */
export function SellersOffersBoard({
  tonight,
  previous,
  units,
  offers,
}: {
  tonight: SellerEventEntry[];
  previous: SellerEventEntry[];
  units: OpsUnitRow[];
  offers: OpsOfferRow[];
}) {
  const unitsBySell = groupBy(units, (u) => u.sell_lead_id);
  const offersByUnit = groupBy(offers, (o) => o.unit_id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Sellers</h1>
          <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
            Tap a seller to see their ticket units and exclusive offers.
          </p>
        </div>
        <BackfillButton />
      </div>

      <DayDrawer
        title="Tonight"
        summary={`${tonight.length} seller${tonight.length === 1 ? "" : "s"}`}
        defaultOpen
      >
        {tonight.length === 0 ? (
          <p className="text-xs text-zinc-500">No active sellers for tonight.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tonight.map((lead) => (
              <SellerOffersRow
                key={lead.id}
                lead={lead}
                units={unitsBySell.get(lead.id) ?? []}
                offersByUnit={offersByUnit}
              />
            ))}
          </ul>
        )}
      </DayDrawer>

      <DayDrawer
        title="Previous days"
        summary={`${previous.length} seller${previous.length === 1 ? "" : "s"}`}
        defaultOpen={false}
      >
        {previous.length === 0 ? (
          <p className="text-xs text-zinc-500">No sellers from previous days.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {previous.map((lead) => (
              <SellerOffersRow
                key={lead.id}
                lead={lead}
                units={unitsBySell.get(lead.id) ?? []}
                offersByUnit={offersByUnit}
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

function SellerOffersRow({
  lead,
  units,
  offersByUnit,
}: {
  lead: SellerEventEntry;
  units: OpsUnitRow[];
  offersByUnit: Map<string, OpsOfferRow[]>;
}) {
  const [open, setOpen] = useState(false);
  const [editLead, setEditLead] = useState(false);
  const contact =
    lead.contactInstagram
      ? `@${lead.contactInstagram}`
      : lead.contactPhone || lead.etransferName || "No contact";
  const offerCount = units.reduce(
    (n, u) => n + (offersByUnit.get(u.id)?.length ?? 0),
    0,
  );

  return (
    <li className="rounded-lg bg-zinc-950/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left focus:outline-none"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-xs font-medium text-zinc-200">{contact}</span>
            <Badge variant="subtle" className="px-1.5 py-0 text-[10px]">
              ×{lead.quantity}
            </Badge>
            {lead.askEach != null && (
              <span className="tabular-nums text-[11px] text-zinc-400">
                ${lead.askEach.toFixed(0)}
              </span>
            )}
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase">
              {lead.status}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-zinc-500">
            {lead.eventName}
            {units.length > 0 ? ` · ${units.length} unit${units.length === 1 ? "" : "s"}` : ""}
            {offerCount > 0 ? ` · ${offerCount} offer${offerCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-zinc-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-zinc-800/60 px-3 pb-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {lead.evidenceUrls.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700"
                onClick={(e) => e.stopPropagation()}
              >
                {lead.evidenceUrls.length > 1 ? `File ${i + 1}` : "File"}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
            {lead.ticketShareUrl && (
              <a
                href={lead.ticketShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700"
                onClick={(e) => e.stopPropagation()}
              >
                Link
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <ActionButton
              label="Ensure units"
              onClick={() => createUnitsForSellLeadAction(lead.id)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-zinc-400"
              onClick={() => setEditLead((v) => !v)}
            >
              {editLead ? "Less" : "Edit lead"}
            </Button>
            <OpsDeleteButton
              confirmMessage={`Delete seller lead for ${contact} (${lead.eventName})?`}
              onConfirm={() => deleteLeadAction(lead.id)}
            />
          </div>

          {editLead && (
            <LeadCard
              lead={lead}
              evidenceUrls={lead.evidenceUrls}
              evidenceUrl={lead.evidenceUrls[0]}
            />
          )}

          {units.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              No ticket units yet — tap Ensure units to split this listing.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {units.map((unit) => (
                <UnitOffersBlock
                  key={unit.id}
                  unit={unit}
                  offers={offersByUnit.get(unit.id) ?? []}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function UnitOffersBlock({
  unit,
  offers,
}: {
  unit: OpsUnitRow;
  offers: OpsOfferRow[];
}) {
  return (
    <li className="rounded-md bg-zinc-900/70 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
        <span className="font-mono text-zinc-500">#{unit.unit_index}</span>
        <span>${Number(unit.price_each).toFixed(2)}</span>
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          {unit.status}
        </Badge>
        <span className="font-mono text-[10px] text-zinc-600">{unit.id.slice(0, 8)}</span>
        {unit.status === "available" && (
          <div className="ml-auto flex flex-wrap gap-1">
            <ActionButton label="Offer next" onClick={() => allocateUnitAction(unit.id)} />
            <ActionButton
              label="Release open"
              onClick={() => releaseUnitToOpenAction(unit.id)}
            />
          </div>
        )}
      </div>

      {offers.length === 0 ? (
        <p className="mt-1.5 text-[10px] text-zinc-600">No offers on this unit yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {offers.map((o) => (
            <OfferActionsRow key={o.id} offer={o} />
          ))}
        </ul>
      )}
    </li>
  );
}

function OfferActionsRow({ offer: o }: { offer: OpsOfferRow }) {
  return (
    <div className="rounded-md bg-zinc-950/60 px-2 py-1.5 text-[11px] text-zinc-300">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {o.status}
        </Badge>
        <span>
          rank {o.rank} · ${Number(o.price_each).toFixed(2)}
        </span>
      </div>
      <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
        {o.seat_key} · exp {new Date(o.expires_at).toLocaleString()}
        {o.buyer_declared_sent_at ? " · buyer says sent" : ""}
        {o.payout_released_at ? " · payout out" : ""}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {o.status === "offered" && (
          <>
            <ActionButton label="Accept" onClick={() => acceptOfferAction(o.id)} />
            <ActionButton label="Pass price" onClick={() => declineOfferAction(o.id, "price")} />
            <ActionButton
              label="Not going"
              onClick={() => declineOfferAction(o.id, "not_going")}
            />
          </>
        )}
        {(o.status === "accepted" || o.status === "offered" || o.status === "needs_review") && (
          <MarkPaidButton offerId={o.id} defaultAmount={Number(o.price_each)} />
        )}
        {o.status === "accepted" && (
          <>
            <ActionButton label="Needs review" onClick={() => markOfferNeedsReviewAction(o.id)} />
            <ActionButton label="Pay failed" onClick={() => markOfferPaymentFailedAction(o.id)} />
          </>
        )}
        {o.status === "paid" && !o.ticket_transferred_at && (
          <ActionButton
            label="Mark forwarded"
            onClick={() => markTicketForwardedAction(o.id)}
          />
        )}
        {o.status === "paid" && !o.payout_released_at && (
          <ActionButton
            label="Mark payout sent"
            onClick={() => releaseSellerPayoutAction(o.id)}
          />
        )}
        <ActionButton label="Reactivate seat" onClick={() => reactivateSeatAction(o.seat_key)} />
      </div>
    </div>
  );
}

function BackfillButton() {
  return (
    <ActionButton
      label="Backfill all units"
      onClick={async () => {
        const r = await backfillSellUnitsAction();
        if (r.error) return r;
        return { ok: true as const };
      }}
    />
  );
}

function MarkPaidButton({
  offerId,
  defaultAmount,
}: {
  offerId: string;
  defaultAmount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      className="h-7 px-2 text-[11px]"
      onClick={() => {
        const amountRaw = window.prompt("E-transfer amount (CAD)", String(defaultAmount));
        if (amountRaw === null) return;
        const amount = Number(amountRaw);
        if (!Number.isFinite(amount) || amount < 0) {
          window.alert("Enter a valid amount.");
          return;
        }
        const reference = window.prompt("Payment reference (optional)") ?? undefined;
        start(async () => {
          const result = await markOfferPaidAction(offerId, {
            amount,
            reference: reference?.trim() || undefined,
          });
          if (result.error) window.alert(result.error);
          router.refresh();
        });
      }}
    >
      {pending ? "…" : "Mark paid"}
    </Button>
  );
}

function ActionButton({
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
      className="h-7 px-2 text-[11px]"
      onClick={(e) => {
        e.stopPropagation();
        start(async () => {
          const result = await onClick();
          if (result.error) window.alert(result.error);
          router.refresh();
        });
      }}
    >
      {pending ? "…" : label}
    </Button>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
