"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  acceptOfferAction,
  allocateUnitAction,
  backfillSellUnitsAction,
  createUnitsForSellLeadAction,
  declineOfferAction,
  markOfferNeedsReviewAction,
  markOfferPaidAction,
  markOfferPaymentFailedAction,
  markTicketForwardedAction,
  reactivateSeatAction,
  releaseSellerPayoutAction,
  releaseUnitToOpenAction,
} from "@/domains/beta-ops/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Unit = {
  id: string;
  sell_lead_id: string;
  event_slug: string;
  unit_index: number;
  price_each: number;
  status: string;
};

type Offer = {
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

export function OffersBoard({
  units,
  offers,
}: {
  units: Unit[];
  offers: Offer[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center gap-2">
        <ActionButton
          label="Backfill all sell units"
          onClick={async () => {
            const r = await backfillSellUnitsAction();
            if (r.error) return r;
            return { ok: true as const };
          }}
        />
        <p className="text-[11px] text-zinc-500">
          Creates missing ticket units for open sell leads (idempotent).
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-100">Available units</h2>
        <p className="mt-1 text-xs text-zinc-400">
          One row per sellable ticket. Offer next walks the real waitlist (no fake-front). Release
          to open drops exclusive holds when the budget is spent or you want a free-for-all near
          doors.
        </p>
        {units.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No available units.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {units.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200"
              >
                <span className="font-mono text-[11px] text-zinc-400">{u.event_slug}</span>
                <span>
                  #{u.unit_index} · ${Number(u.price_each).toFixed(2)}
                </span>
                <span className="font-mono text-[10px] text-zinc-500">{u.id.slice(0, 8)}</span>
                <div className="ml-auto flex flex-wrap gap-1">
                  <ActionButton
                    label="Ensure units"
                    onClick={() => createUnitsForSellLeadAction(u.sell_lead_id)}
                  />
                  <ActionButton label="Offer next" onClick={() => allocateUnitAction(u.id)} />
                  <ActionButton
                    label="Release to open"
                    onClick={() => releaseUnitToOpenAction(u.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-100">Offers</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Response + payment clocks. Decline requeues immediately; unpaid expiry is a hard strike.
          Mark paid records the Interac amount/reference on the offer.
        </p>
        {offers.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No offers yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {offers.map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-200 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{o.status}</Badge>
                    <span className="font-mono text-[11px] text-zinc-400">{o.event_slug}</span>
                    <span>
                      rank {o.rank} · ${Number(o.price_each).toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">
                    {o.seat_key} · expires {new Date(o.expires_at).toLocaleString()}
                    {o.payment_due_at
                      ? ` · pay by ${new Date(o.payment_due_at).toLocaleString()}`
                      : ""}
                    {o.buyer_declared_sent_at ? " · buyer says sent" : ""}
                    {o.payout_released_at ? " · payout released" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {o.status === "offered" && (
                    <>
                      <ActionButton label="Accept" onClick={() => acceptOfferAction(o.id)} />
                      <ActionButton
                        label="Pass price"
                        onClick={() => declineOfferAction(o.id, "price")}
                      />
                      <ActionButton
                        label="Not going"
                        onClick={() => declineOfferAction(o.id, "not_going")}
                      />
                    </>
                  )}
                  {(o.status === "accepted" ||
                    o.status === "offered" ||
                    o.status === "needs_review") && (
                    <MarkPaidButton
                      offerId={o.id}
                      defaultAmount={Number(o.price_each)}
                    />
                  )}
                  {o.status === "accepted" && (
                    <>
                      <ActionButton
                        label="Needs review"
                        onClick={() => markOfferNeedsReviewAction(o.id)}
                      />
                      <ActionButton
                        label="Pay failed"
                        onClick={() => markOfferPaymentFailedAction(o.id)}
                      />
                    </>
                  )}
                  {o.status === "paid" && !o.ticket_transferred_at && (
                    <ActionButton
                      label="Mark ticket forwarded"
                      onClick={() => markTicketForwardedAction(o.id)}
                    />
                  )}
                  {o.status === "paid" && !o.payout_released_at && (
                    <ActionButton
                      label="Mark payout sent"
                      onClick={() => releaseSellerPayoutAction(o.id)}
                    />
                  )}
                  <ActionButton
                    label="Reactivate seat"
                    onClick={() => reactivateSeatAction(o.seat_key)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
      onClick={() => {
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
