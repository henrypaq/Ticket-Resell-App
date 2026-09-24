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
import { BUTTON_CLASS } from "@/components/forms/field-styles";
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
 * Fixed-price buy screen — always a phone-width column (DICE/Shotgun-style),
 * even when opened from a desktop browser. Title lives in the hero scrim;
 * Join sits in a sticky bottom bar.
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

  const blurb =
    event.blurb &&
    event.blurb.trim() &&
    event.blurb.trim().toLowerCase() !== `${event.name} at ${event.venue}.`.toLowerCase()
      ? event.blurb.trim()
      : null;

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
    <div className="fixed inset-0 z-[60] flex justify-center bg-base">
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto overscroll-contain bg-base text-ink">
        <form
          action={formAction}
          className="flex min-h-full flex-col"
          onSubmit={() => {
            void saveContactDraftAction({ phone, instagram });
          }}
        >
          <input type="hidden" name="eventSlug" value={event.slug} />
          <input type="hidden" name="quantity" value={quantity} />
          <input type="hidden" name="maxPriceEach" value={String(priceEach)} />
          <input type="hidden" name="contactPhone" value={phone} />
          <input
            type="hidden"
            name="contactInstagram"
            value={instagram.replace(/^@+/, "").trim()}
          />

          {/* Hero — flyer bleeds into page; title sits in the fade */}
          <div className="relative isolate h-[min(48vh,380px)] w-full shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.flyerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(11,11,12,0.4) 0%, rgba(11,11,12,0.1) 40%, rgba(11,11,12,0.85) 78%, #0b0b0c 100%)",
              }}
            />

            <div className="relative flex h-full flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={handleBack}
                className="font-ui inline-flex items-center gap-1.5 self-start rounded-full bg-black/40 px-3 py-1.5 text-[13px] font-semibold text-ink backdrop-blur-md transition-colors hover:bg-black/55"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              <div className="mt-auto pb-5">
                <span className="font-ui inline-block rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-950">
                  Fixed · {formatCad(priceEach)}
                </span>
                <h1 className="headline mt-2 text-[26px] leading-[1.1] tracking-tight text-ink">
                  {event.name}
                </h1>
                <p className="mt-1 text-[13px] font-medium text-ink/70">
                  {formatBetaEventWhen(day)}
                  <span className="text-ink/40"> · </span>
                  {event.venue}
                  <span className="text-ink/40"> · </span>
                  {event.city}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 flex flex-1 flex-col gap-5 px-4 pb-2 pt-1">
            {(event.entryNote || blurb) && (
              <div className="space-y-1">
                {event.entryNote && (
                  <p className="font-ui text-[13px] font-semibold tracking-tight text-amber-300">
                    {event.entryNote}
                  </p>
                )}
                {blurb && (
                  <p className="text-[13.5px] leading-relaxed text-muted">{blurb}</p>
                )}
              </div>
            )}

            <section className="rounded-2xl bg-white/[0.04] px-3.5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-ui text-[13px] font-semibold tracking-tight text-ink">
                  Tickets
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Fewer"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="font-ui flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08] text-[17px] text-ink transition-colors hover:bg-white/[0.12] disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="font-ui min-w-[1.5ch] text-center text-[16px] font-bold tabular-nums tracking-tight text-ink">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="More"
                    disabled={quantity >= QUICK_MAX_TICKETS}
                    onClick={() => setQuantity((q) => Math.min(QUICK_MAX_TICKETS, q + 1))}
                    className="font-ui flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08] text-[17px] text-ink transition-colors hover:bg-white/[0.12] disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1 border-t border-hairline pt-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted">
                    Ticket{quantity > 1 ? ` × ${quantity}` : ""}
                  </span>
                  <span className="tabular-nums text-ink">{formatCad(ticketsSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted">
                    {SERVICE_FEE_LABEL}
                    {quantity > 1 ? ` × ${quantity}` : ""}
                  </span>
                  <span className="tabular-nums text-ink">{formatCad(feesTotal)}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5">
                  <span className="font-ui text-[13px] font-semibold tracking-tight text-ink">
                    Total
                  </span>
                  <span className="font-ui text-[17px] font-bold tabular-nums tracking-tight text-amber-300">
                    {formatCad(grandTotal)}
                  </span>
                </div>
              </div>

              <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
                Pay by Interac when a ticket is held for you.
              </p>
            </section>

            <section>
              <p className="font-ui mb-2.5 text-[13px] font-semibold tracking-tight text-ink">
                Contact
              </p>
              <ContactFields
                phoneCountry={phoneCountry}
                phoneNational={phoneNational}
                instagram={instagram}
                onPhoneCountry={setPhoneCountry}
                onPhoneNational={setPhoneNational}
                onInstagram={setInstagram}
                hint="We’ll notify you when a ticket is held at this price."
              />
            </section>

            {state.error && (
              <p role="alert" className="text-[13.5px] text-urgency">
                {state.error}
              </p>
            )}
          </div>

          {/* Sticky iOS-style action bar — stays inside the phone column */}
          <div className="pointer-events-none sticky bottom-0 z-20 mt-auto border-t border-hairline bg-base/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
            <button
              type="submit"
              disabled={!canSubmit || pending || Boolean(state.ok)}
              className={`pointer-events-auto ${BUTTON_CLASS} w-full ${
                canSubmit && !pending && !state.ok
                  ? ""
                  : "!bg-[#ffe500]/30 !text-black/40"
              }`}
            >
              {pending || state.ok ? "Submitting…" : `Join · ${formatCad(grandTotal)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
