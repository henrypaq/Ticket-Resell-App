"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import {
  markFixedPricePaymentReceivedAction,
  markFixedPriceTicketForwardedAction,
  markOfferPaidAction,
  markSellTicketReceivedAction,
  markTicketForwardedAction,
  releaseSellerPayoutAction,
} from "@/domains/beta-ops/actions";
import type {
  OpsCompletedItem,
  OpsFixedPriceTxnItem,
  OpsForwardTicketItem,
  OpsPaymentQueueItem,
  OpsPayoutItem,
  OpsPerson,
  OpsTicketCustodyItem,
  OpsTransactionsBoard,
} from "@/domains/beta-ops/transaction-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Flat ops transaction list — open rows first, completed in a drawer below.
 */
export function TransactionsBoard({ board }: { board: OpsTransactionsBoard }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [completedOpen, setCompletedOpen] = useState(false);

  const fixedOpen = (board.fixedPriceTxns ?? []).filter((t) => t.status !== "done");
  const fixedDone = (board.fixedPriceTxns ?? []).filter((t) => t.status === "done");
  const openCount =
    fixedOpen.length +
    board.paymentsToVerify.length +
    board.ticketsToVerify.length +
    board.ticketsToForward.length +
    board.payoutsToSend.length;
  const completedCount = board.recentlyCompleted.length + fixedDone.length;
  const empty = openCount === 0 && completedCount === 0;

  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [router]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Transactions</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="h-8 gap-1.5 border-zinc-700 text-xs text-zinc-200"
            onClick={() => startRefresh(() => router.refresh())}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          {openCount > 0 && (
            <Badge className="bg-amber-400/15 text-amber-200 hover:bg-amber-400/15">
              {openCount} open
            </Badge>
          )}
        </div>
      </div>

      {empty ? (
        <p className="rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
          No transactions yet. Buyer “I’ve sent” and seller “I’ve transferred” land here.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {fixedOpen.map((item) => (
              <FixedPriceTxnRow key={item.leadId} item={item} />
            ))}
            {board.paymentsToVerify.map((item) => (
              <PaymentRow key={item.offerId} item={item} />
            ))}
            {board.ticketsToVerify.map((item) => (
              <TicketCustodyRow key={item.sellLeadId} item={item} />
            ))}
            {board.ticketsToForward.map((item) => (
              <ForwardTicketRow key={item.offerId} item={item} />
            ))}
            {board.payoutsToSend.map((item) => (
              <PayoutRow key={item.offerId} item={item} />
            ))}
            {openCount === 0 && (
              <li className="px-1 py-3 text-sm text-zinc-500">No open transactions.</li>
            )}
          </ul>

          {completedCount > 0 && (
            <div className="border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => setCompletedOpen((v) => !v)}
                className="flex w-full items-center gap-2 text-left"
              >
                {completedOpen ? (
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Completed
                </span>
                <span className="text-xs tabular-nums text-zinc-600">({completedCount})</span>
              </button>
              {completedOpen && (
                <ul className="mt-2.5 flex flex-col gap-2">
                  {fixedDone.map((item) => (
                    <FixedPriceTxnRow key={item.leadId} item={item} />
                  ))}
                  {board.recentlyCompleted.map((item) => (
                    <CompletedRow key={item.offerId} item={item} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function contactLine(person: OpsPerson): string {
  return (
    [
      person.email,
      person.phone,
      person.instagram ? `@${person.instagram}` : null,
      person.etransferEmail && person.etransferEmail !== person.email
        ? `Interac ${person.etransferEmail}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "No contact on file"
  );
}

function FixedPriceTxnRow({ item }: { item: OpsFixedPriceTxnItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const paymentReady = item.status === "awaiting_ticket" || item.status === "done";
  const done = item.status === "done";

  return (
    // The id is what the ops alert email links to (`/ops#txn-<leadId>`). The
    // highlight is CSS `:target`, so arriving from the email marks the row
    // without any hash-reading state on the client.
    <li
      id={`txn-${item.leadId}`}
      className="scroll-mt-24 rounded-xl bg-zinc-900/70 px-3.5 py-3.5 target:ring-2 target:ring-amber-400/70"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-zinc-100">
            {item.buyer.name || "Name missing"}
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-300">
            {item.buyer.email || "Email missing"}
          </p>
          {(item.buyer.phone || item.buyer.instagram) && (
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {[
                item.buyer.phone,
                item.buyer.instagram ? `@${item.buyer.instagram}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className="mt-2 text-[13px] text-zinc-200">
            {item.eventName}
            <span className="text-zinc-500"> · </span>
            <span className="tabular-nums">${item.amount.toFixed(2)}</span>
            {item.quantity > 1 ? (
              <span className="text-zinc-500"> · ×{item.quantity}</span>
            ) : null}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-amber-200/80">{item.memoHint}</p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Declared {formatWhen(item.buyerDeclaredSentAt)}
            {item.paymentRecordedAt
              ? ` · paid ${formatWhen(item.paymentRecordedAt)}`
              : ""}
            {item.ticketForwardedAt
              ? ` · transferred ${formatWhen(item.ticketForwardedAt)}`
              : ""}
          </p>
          {error && (
            <p className="mt-2 text-[11px] text-red-300" role="alert">
              {error}
            </p>
          )}
        </div>

        {!done && (
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Button
              type="button"
              size="sm"
              disabled={pending || paymentReady}
              className={
                paymentReady
                  ? "h-8 cursor-default bg-zinc-800 text-zinc-500 hover:bg-zinc-800"
                  : "h-8 bg-amber-400 text-zinc-950 hover:bg-amber-300"
              }
              onClick={() => {
                if (paymentReady) return;
                setError(null);
                start(async () => {
                  const r = await markFixedPricePaymentReceivedAction(item.leadId);
                  if (r.error) setError(r.error);
                  else router.refresh();
                });
              }}
            >
              {paymentReady
                ? "Interac confirmed"
                : pending
                  ? "…"
                  : "Confirm Interac received"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || !paymentReady}
              className={
                paymentReady
                  ? "h-8 bg-violet-400 text-zinc-950 hover:bg-violet-300"
                  : "h-8 cursor-not-allowed bg-zinc-800 text-zinc-500 hover:bg-zinc-800"
              }
              onClick={() => {
                if (!paymentReady) return;
                setError(null);
                start(async () => {
                  const r = await markFixedPriceTicketForwardedAction(item.leadId);
                  if (r.error) setError(r.error);
                  else router.refresh();
                });
              }}
            >
              {pending && paymentReady ? "…" : "Confirm ticket transferred"}
            </Button>
          </div>
        )}

        {done && (
          <Badge className="shrink-0 self-start bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/15">
            Done
          </Badge>
        )}
      </div>
    </li>
  );
}

function PaymentRow({ item }: { item: OpsPaymentQueueItem }) {
  return (
    <li className="rounded-xl bg-zinc-900/70 px-3.5 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-zinc-100">
            {item.buyer.name || "Buyer"}
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-400">{contactLine(item.buyer)}</p>
          <p className="mt-2 text-[13px] text-zinc-200">
            {item.eventName}
            <span className="text-zinc-500"> · </span>
            <span className="tabular-nums">${item.priceEach.toFixed(2)}</span>
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-amber-200/80">{item.memoHint}</p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Declared {formatWhen(item.buyerDeclaredSentAt)}
            {item.paymentDueAt ? ` · due ${formatWhen(item.paymentDueAt)}` : ""}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Seller: {item.seller.name || "Unknown"}
            {item.seller.phone || item.seller.instagram
              ? ` · ${[item.seller.phone, item.seller.instagram ? `@${item.seller.instagram}` : null].filter(Boolean).join(" · ")}`
              : ""}
          </p>
        </div>
        <MarkPaidButton offerId={item.offerId} defaultAmount={item.priceEach} />
      </div>
    </li>
  );
}

function TicketCustodyRow({ item }: { item: OpsTicketCustodyItem }) {
  return (
    <li className="rounded-xl bg-zinc-900/70 px-3.5 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-zinc-100">
            {item.seller.name || "Seller"}
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-400">{contactLine(item.seller)}</p>
          <p className="mt-2 text-[13px] text-zinc-200">
            {item.eventName}
            <span className="text-zinc-500"> · </span>×{item.quantity}
            {item.askEach != null ? (
              <>
                <span className="text-zinc-500"> · </span>
                <span className="tabular-nums">${item.askEach.toFixed(0)}</span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Seller confirmed {formatWhen(item.sellerTicketSentAt)}
          </p>
          {(item.evidenceUrls.length > 0 || item.ticketShareUrl) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.ticketShareUrl && (
                <a
                  href={item.ticketShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-zinc-700"
                >
                  Share link
                </a>
              )}
              {item.evidenceUrls.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-zinc-700"
                >
                  Evidence {item.evidenceUrls.length > 1 ? i + 1 : ""}
                </a>
              ))}
            </div>
          )}
        </div>
        <ActionButton
          label="Confirm received"
          onClick={() => markSellTicketReceivedAction(item.sellLeadId)}
        />
      </div>
    </li>
  );
}

function ForwardTicketRow({ item }: { item: OpsForwardTicketItem }) {
  return (
    <li className="rounded-xl bg-zinc-900/70 px-3.5 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-zinc-100">
            {item.buyer.name || "Buyer"}
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-400">{contactLine(item.buyer)}</p>
          <p className="mt-2 text-[13px] text-zinc-200">
            {item.eventName}
            <span className="text-zinc-500"> · </span>
            <span className="tabular-nums">${item.priceEach.toFixed(2)}</span>
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {item.ticketReceivedAt
              ? `In custody since ${formatWhen(item.ticketReceivedAt)}`
              : "Custody not marked yet"}
            {item.paidAt ? ` · paid ${formatWhen(item.paidAt)}` : ""}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            From seller: {item.seller.name || "Unknown"}
          </p>
        </div>
        <ActionButton
          label="Mark forwarded to buyer"
          onClick={() => markTicketForwardedAction(item.offerId)}
        />
      </div>
    </li>
  );
}

function PayoutRow({ item }: { item: OpsPayoutItem }) {
  return (
    <li className="rounded-xl bg-zinc-900/70 px-3.5 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-zinc-100">
            {item.seller.name || "Seller"}
          </p>
          <p className="mt-0.5 text-[12px] text-zinc-400">{contactLine(item.seller)}</p>
          <p className="mt-2 text-[13px] text-zinc-200">
            {item.eventName}
            <span className="text-zinc-500"> · </span>
            <span className="tabular-nums">${item.amount.toFixed(2)}</span>
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Pay to{" "}
            <span className="font-medium text-zinc-200">
              {item.seller.etransferEmail ||
                item.seller.etransferPhone ||
                item.seller.name ||
                "seller Interac on file"}
            </span>
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {item.ticketForwardedAt
              ? `Ticket forwarded ${formatWhen(item.ticketForwardedAt)}`
              : "Ticket not marked forwarded yet"}
          </p>
        </div>
        <ActionButton
          label="Mark payout sent"
          onClick={() => releaseSellerPayoutAction(item.offerId)}
        />
      </div>
    </li>
  );
}

function CompletedRow({ item }: { item: OpsCompletedItem }) {
  return (
    <li className="rounded-xl bg-zinc-900/50 px-3.5 py-3">
      <p className="text-[14px] font-semibold text-zinc-200">
        {[item.buyerName, item.sellerName].filter(Boolean).join(" → ") || "Completed trade"}
      </p>
      <p className="mt-1 text-[13px] text-zinc-400">
        {item.eventName}
        <span className="text-zinc-600"> · </span>
        <span className="tabular-nums">${item.amount.toFixed(2)}</span>
      </p>
      <p className="mt-1 text-[10px] text-zinc-500">
        Payout {formatWhen(item.payoutReleasedAt)}
        <span
          className={
            item.sellerPayoutConfirmedAt ? " text-emerald-400/90" : " text-amber-300/80"
          }
        >
          {item.sellerPayoutConfirmedAt
            ? " · seller confirmed payout"
            : " · awaiting seller confirm"}
        </span>
      </p>
    </li>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
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
      disabled={pending}
      className="h-8 shrink-0 bg-amber-400 px-3 text-[11px] font-semibold text-zinc-950 hover:bg-amber-300"
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
      {pending ? "…" : "Mark payment received"}
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
      className="h-8 shrink-0 px-3 text-[11px]"
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
