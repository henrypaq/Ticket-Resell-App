"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  markOfferPaidAction,
  markSellTicketReceivedAction,
  markTicketForwardedAction,
  releaseSellerPayoutAction,
} from "@/domains/beta-ops/actions";
import type {
  OpsCompletedItem,
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
 * Ops home: four queues in the money + ticket pipeline.
 * 1 Verify Interac in → 2 Verify tickets in → 3 Forward tickets → 4 Send payouts
 */
export function TransactionsBoard({ board }: { board: OpsTransactionsBoard }) {
  const empty =
    board.attentionCount === 0 && board.recentlyCompleted.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Transactions</h1>
          <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
            Work top to bottom: money in, tickets in custody, tickets out, payouts out.
          </p>
        </div>
        {board.attentionCount > 0 && (
          <Badge className="bg-amber-400/15 text-amber-200 hover:bg-amber-400/15">
            {board.attentionCount} need you
          </Badge>
        )}
      </div>

      {empty ? (
        <p className="rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
          Nothing in the pipeline right now. Buyer “I’ve sent” and seller “I’ve transferred”
          land here.
        </p>
      ) : (
        <>
          <QueueSection
            step="1"
            title="Verify payments"
            hint="Buyer tapped “I’ve sent the money.” Match the Interac, then mark received."
            count={board.paymentsToVerify.length}
            accent="amber"
          >
            {board.paymentsToVerify.length === 0 ? (
              <EmptyRow text="No payments waiting." />
            ) : (
              board.paymentsToVerify.map((item) => <PaymentCard key={item.offerId} item={item} />)
            )}
          </QueueSection>

          <QueueSection
            step="2"
            title="Verify tickets in"
            hint="Seller tapped “I’ve transferred.” Confirm the Café / platform inbox actually has it."
            count={board.ticketsToVerify.length}
            accent="sky"
          >
            {board.ticketsToVerify.length === 0 ? (
              <EmptyRow text="No ticket transfers waiting." />
            ) : (
              board.ticketsToVerify.map((item) => (
                <TicketCustodyCard key={item.sellLeadId} item={item} />
              ))
            )}
          </QueueSection>

          <QueueSection
            step="3"
            title="Forward tickets to buyers"
            hint="Payment is confirmed. Send the ticket from custody to the buyer, then mark forwarded."
            count={board.ticketsToForward.length}
            accent="violet"
          >
            {board.ticketsToForward.length === 0 ? (
              <EmptyRow text="No tickets waiting to go out." />
            ) : (
              board.ticketsToForward.map((item) => (
                <ForwardTicketCard key={item.offerId} item={item} />
              ))
            )}
          </QueueSection>

          <QueueSection
            step="4"
            title="Send seller payouts"
            hint="Release Interac to the seller’s listing details once you’re ready."
            count={board.payoutsToSend.length}
            accent="emerald"
          >
            {board.payoutsToSend.length === 0 ? (
              <EmptyRow text="No payouts waiting." />
            ) : (
              board.payoutsToSend.map((item) => <PayoutCard key={item.offerId} item={item} />)
            )}
          </QueueSection>

          {board.recentlyCompleted.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Recently completed
              </h2>
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {board.recentlyCompleted.map((item) => (
                  <CompletedRow key={item.offerId} item={item} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function QueueSection({
  step,
  title,
  hint,
  count,
  accent,
  children,
}: {
  step: string;
  title: string;
  hint: string;
  count: number;
  accent: "amber" | "sky" | "violet" | "emerald";
  children: React.ReactNode;
}) {
  const ring =
    accent === "amber"
      ? "border-amber-500/25"
      : accent === "sky"
        ? "border-sky-500/25"
        : accent === "violet"
          ? "border-violet-500/25"
          : "border-emerald-500/25";
  return (
    <section className={`rounded-xl border ${ring} bg-zinc-900/50 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Step {step}
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-zinc-100">
            {title}
            {count > 0 ? (
              <span className="ml-2 tabular-nums text-zinc-400">({count})</span>
            ) : null}
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{hint}</p>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-2.5">{children}</ul>
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <li className="px-1 py-2 text-xs text-zinc-600">{text}</li>;
}

function PersonBlock({ label, person }: { label: string; person: OpsPerson }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-zinc-100">
        {person.name || "Unknown"}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-zinc-400">
        {[
          person.phone,
          person.email,
          person.instagram ? `@${person.instagram}` : null,
          person.etransferEmail ? `Interac ${person.etransferEmail}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No contact on file"}
      </p>
    </div>
  );
}

function PaymentCard({ item }: { item: OpsPaymentQueueItem }) {
  return (
    <li className="rounded-lg bg-zinc-950/70 px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-zinc-100">
            {item.eventName} · ${item.priceEach.toFixed(2)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-amber-200/90">{item.memoHint}</p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Declared {formatWhen(item.buyerDeclaredSentAt)}
            {item.paymentDueAt ? ` · due ${formatWhen(item.paymentDueAt)}` : ""}
          </p>
        </div>
        <MarkPaidButton offerId={item.offerId} defaultAmount={item.priceEach} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <PersonBlock label="Buyer" person={item.buyer} />
        <PersonBlock label="Seller" person={item.seller} />
      </div>
    </li>
  );
}

function TicketCustodyCard({ item }: { item: OpsTicketCustodyItem }) {
  return (
    <li className="rounded-lg bg-zinc-950/70 px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-100">
            {item.eventName} · ×{item.quantity}
            {item.askEach != null ? ` · $${item.askEach.toFixed(0)}` : ""}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Seller confirmed {formatWhen(item.sellerTicketSentAt)}
          </p>
        </div>
        <ActionButton
          label="Confirm received"
          onClick={() => markSellTicketReceivedAction(item.sellLeadId)}
        />
      </div>
      <div className="mt-3">
        <PersonBlock label="Seller" person={item.seller} />
      </div>
      {(item.evidenceUrls.length > 0 || item.ticketShareUrl) && (
        <div className="mt-3 flex flex-wrap gap-2">
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
    </li>
  );
}

function ForwardTicketCard({ item }: { item: OpsForwardTicketItem }) {
  return (
    <li className="rounded-lg bg-zinc-950/70 px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-zinc-100">
            {item.eventName} · ${item.priceEach.toFixed(2)}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {item.ticketReceivedAt
              ? `In custody since ${formatWhen(item.ticketReceivedAt)}`
              : "Custody not marked yet — still ok to forward if you have the ticket"}
            {item.paidAt ? ` · paid ${formatWhen(item.paidAt)}` : ""}
          </p>
        </div>
        <ActionButton
          label="Mark forwarded to buyer"
          onClick={() => markTicketForwardedAction(item.offerId)}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <PersonBlock label="Buyer" person={item.buyer} />
        <PersonBlock label="Seller" person={item.seller} />
      </div>
    </li>
  );
}

function PayoutCard({ item }: { item: OpsPayoutItem }) {
  return (
    <li className="rounded-lg bg-zinc-950/70 px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-zinc-100">
            {item.eventName} · ${item.amount.toFixed(2)}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {item.ticketForwardedAt
              ? `Ticket forwarded ${formatWhen(item.ticketForwardedAt)}`
              : "Ticket not marked forwarded yet"}
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
        </div>
        <ActionButton
          label="Mark payout sent"
          onClick={() => releaseSellerPayoutAction(item.offerId)}
        />
      </div>
      <div className="mt-3">
        <PersonBlock label="Seller" person={item.seller} />
      </div>
    </li>
  );
}

function CompletedRow({ item }: { item: OpsCompletedItem }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
      <span className="min-w-0 truncate">
        {item.eventName} · ${item.amount.toFixed(2)}
        {item.buyerName || item.sellerName
          ? ` · ${[item.buyerName, item.sellerName].filter(Boolean).join(" → ")}`
          : ""}
        <span
          className={
            item.sellerPayoutConfirmedAt
              ? " text-emerald-400/90"
              : " text-amber-300/80"
          }
        >
          {item.sellerPayoutConfirmedAt
            ? " · seller confirmed payout"
            : " · awaiting seller confirm"}
        </span>
      </span>
      <span className="shrink-0 tabular-nums text-zinc-500">
        {formatWhen(item.payoutReleasedAt)}
      </span>
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
