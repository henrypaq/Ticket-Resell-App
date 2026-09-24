"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatBetaEventWhen,
  type BetaEvent,
  type BetaWeekday,
} from "@/lib/beta-events";
import { submitQuickBuyAction, saveContactDraftAction } from "@/domains/beta-quick/actions";
import type { QuickActionState } from "@/domains/beta-quick/shared";
import { QUICK_MAX_TICKETS } from "@/domains/beta-quick/shared";
import type { GoContactProfile } from "@/domains/beta-go/shared";
import { buildFeeBreakdown, SERVICE_FEE_LABEL } from "@/lib/compliance/fees";
import { formatCad } from "@/lib/format";
import { COUNTRY_CODES } from "@/lib/country-codes";
import { ArrowLeft } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ContactFields,
  DEFAULT_COUNTRY_ISO2,
  composeQuickPhone,
} from "./flow-fields";
import { logFlowCompleted, useBetaFlowStepLog } from "./use-beta-flow-log";
import { logBetaFlowStepAction } from "@/domains/beta-quick/funnel-log";

const initial: QuickActionState = {};

function splitSavedPhone(e164: string | null | undefined): { iso2: string; national: string } {
  if (!e164) return { iso2: DEFAULT_COUNTRY_ISO2, national: "" };
  const digits = e164.replace(/\D/g, "");
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial) && digits.length > c.dial.length) {
      return { iso2: c.iso2, national: digits.slice(c.dial.length) };
    }
  }
  return { iso2: DEFAULT_COUNTRY_ISO2, national: digits };
}

/**
 * Buyer-first screen for predetermined-price events: colorful banner, detail
 * rows, then quantity + itemized payment. Ops amber accent, shadcn surfaces.
 */
export function FixedPriceEventScreen({
  event,
  day,
  savedContact,
  onBack,
  backHref = "/",
}: {
  event: BetaEvent;
  day: BetaWeekday;
  savedContact?: GoContactProfile | null;
  onBack?: () => void;
  backHref?: string;
}) {
  const router = useRouter();
  const priceEach = event.fixedPriceEach ?? 0;
  const [quantity, setQuantity] = useState(1);
  const savedPhone = splitSavedPhone(savedContact?.contactPhone);
  const [phoneCountry, setPhoneCountry] = useState(savedPhone.iso2);
  const [phoneNational, setPhoneNational] = useState(savedPhone.national);
  const [instagram, setInstagram] = useState(savedContact?.contactInstagram ?? "");
  const [state, formAction, pending] = useActionState(submitQuickBuyAction, initial);

  const phone = composeQuickPhone(phoneCountry, phoneNational);
  const phoneOk = phoneNational.replace(/\D/g, "").length >= 7;
  const igOk = instagram.replace(/^@+/, "").trim().length >= 2;
  const canSubmit = phoneOk || igOk;

  const perTicket = buildFeeBreakdown(priceEach);
  const ticketsSubtotal = Math.round(priceEach * quantity * 100) / 100;
  const feesTotal = Math.round(perTicket.serviceFee * quantity * 100) / 100;
  const grandTotal = Math.round((ticketsSubtotal + feesTotal) * 100) / 100;

  useBetaFlowStepLog({
    intent: "buy",
    stepKey: "fixed_price",
    eventSlug: event.slug,
    enabled: !state.ok,
  });

  useEffect(() => {
    if (!state.ok) return;
    void logBetaFlowStepAction({ intent: "buy", step: "submit", eventSlug: event.slug });
    logFlowCompleted({ intent: "buy", eventSlug: event.slug });
    if (state.offerId) router.replace(`/offer/${state.offerId}`);
    else router.replace("/done?intent=buy");
  }, [state.ok, state.offerId, router, event.slug]);

  function handleBack() {
    if (onBack) onBack();
    else router.push(backHref);
  }

  return (
    <div className="relative -mx-5 flex min-h-full flex-col bg-zinc-950 text-zinc-100 sm:-mx-6">
      {/* Colorful banner */}
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.flyerUrl}
            alt=""
            className="h-full w-full scale-110 object-cover blur-[2px] opacity-55"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(251,191,36,0.55) 0%, rgba(14,165,233,0.35) 42%, rgba(168,85,247,0.45) 78%, rgba(9,9,11,0.92) 100%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35), transparent 40%), radial-gradient(circle at 80% 20%, rgba(251,191,36,0.45), transparent 35%), linear-gradient(to bottom, transparent 40%, #09090b 100%)",
            }}
          />
        </div>

        <div className="relative px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-md bg-zinc-950/40 px-2.5 py-1.5 text-[12.5px] font-semibold text-zinc-100 backdrop-blur-md transition-colors hover:bg-zinc-950/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-amber-400/90 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-950">
              Fixed price
            </Badge>
            <Badge variant="outline" className="border-white/20 bg-white/10 text-[10px] text-zinc-100">
              {formatCad(priceEach)} / ticket
            </Badge>
          </div>

          <h1 className="mt-3 max-w-[18ch] text-[28px] font-semibold leading-[1.12] tracking-tight text-white drop-shadow-sm sm:text-[32px]">
            {event.name}
          </h1>
          <p className="mt-2 text-[13px] font-medium text-zinc-200/90">
            {formatBetaEventWhen(day)}
          </p>
        </div>
      </div>

      <div className="relative z-10 -mt-2 flex flex-1 flex-col gap-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        {/* Detail rows */}
        <Card className="border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Event details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-zinc-800/80 px-0 pb-0">
            <DetailRow label="Venue" value={event.venue} />
            <DetailRow label="City" value={event.city} />
            <DetailRow label="When" value={formatBetaEventWhen(day)} />
            {event.entryNote && <DetailRow label="Entry" value={event.entryNote} accent />}
            {event.blurb && (
              <div className="px-4 py-3 sm:px-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                  About
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">{event.blurb}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment */}
        <form
          action={formAction}
          className="flex flex-col gap-3"
          onSubmit={() => {
            void saveContactDraftAction({ phone, instagram });
          }}
        >
          <input type="hidden" name="eventSlug" value={event.slug} />
          <input type="hidden" name="quantity" value={quantity} />
          <input type="hidden" name="maxPriceEach" value={String(priceEach)} />
          <input type="hidden" name="contactPhone" value={phone} />
          <input type="hidden" name="contactInstagram" value={instagram.replace(/^@+/, "").trim()} />

          <Card className="border border-zinc-800/80 bg-zinc-900/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-[13px] font-semibold tracking-tight text-zinc-100">
                  Your tickets
                </CardTitle>
                <span className="text-[11px] text-zinc-500">Max {QUICK_MAX_TICKETS}</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[13px] text-zinc-400">Quantity</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    disabled={quantity <= 1}
                    className="h-9 w-9 rounded-lg bg-zinc-800 text-lg text-zinc-100"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Fewer"
                  >
                    −
                  </Button>
                  <Input
                    readOnly
                    value={quantity}
                    className="h-9 w-12 border-0 bg-zinc-950 text-center text-sm font-semibold tabular-nums text-zinc-100"
                    aria-label="Ticket quantity"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    disabled={quantity >= QUICK_MAX_TICKETS}
                    className="h-9 w-9 rounded-lg bg-zinc-800 text-lg text-zinc-100"
                    onClick={() => setQuantity((q) => Math.min(QUICK_MAX_TICKETS, q + 1))}
                    aria-label="More"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60">
                <BreakdownRow
                  label={`Ticket × ${quantity}`}
                  value={formatCad(ticketsSubtotal)}
                />
                <BreakdownRow
                  label={`${SERVICE_FEE_LABEL} × ${quantity}`}
                  value={formatCad(feesTotal)}
                />
                <div className="flex items-center justify-between gap-3 border-t border-amber-400/25 bg-amber-400/10 px-3.5 py-3">
                  <span className="text-[13px] font-semibold text-amber-200">Total due</span>
                  <span className="text-[16px] font-bold tabular-nums tracking-tight text-amber-300">
                    {formatCad(grandTotal)}
                  </span>
                </div>
              </div>

              <p className="text-[11.5px] leading-relaxed text-zinc-500">
                Price is set for this event. You&apos;ll get an exclusive hold when a ticket is
                available — then pay the total above by Interac.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-zinc-800/80 bg-zinc-900/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-[13px] font-semibold tracking-tight text-zinc-100">
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ContactFields
                phoneCountry={phoneCountry}
                phoneNational={phoneNational}
                instagram={instagram}
                onPhoneCountry={setPhoneCountry}
                onPhoneNational={setPhoneNational}
                onInstagram={setInstagram}
                hint="We’ll notify you when a ticket is held at this price."
              />
            </CardContent>
          </Card>

          {state.error && (
            <p role="alert" className="text-[13px] text-amber-400">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            disabled={!canSubmit || pending || Boolean(state.ok)}
            className="h-12 w-full rounded-xl bg-amber-400 text-[15px] font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          >
            {pending || state.ok ? "Submitting…" : `Join at ${formatCad(grandTotal)}`}
          </Button>
        </form>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-5">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </span>
      <span
        className={`text-right text-[13.5px] font-medium leading-snug ${
          accent ? "text-amber-300" : "text-zinc-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
      <span className="text-zinc-400">{label}</span>
      <span className="tabular-nums text-zinc-200">{value}</span>
    </div>
  );
}
