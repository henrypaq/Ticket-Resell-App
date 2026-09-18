"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BETA_SOCIALS,
  formatBetaEventWhenShort,
  isPastNightlife,
  type BetaEvent,
  type BetaWeekday,
} from "@/lib/beta-events";
import {
  dismissPastSellLeadsAction,
  leaveWaitlistLeadAction,
  removeSellLeadAction,
  updateWaitlistLeadAction,
} from "@/domains/beta-quick/actions";
import { buyerReactivateSeatAction } from "@/domains/beta-matching/buyer-actions";
import type { GoActivityEntry, QuickActionState, QuickWaitlistEntry } from "@/domains/beta-quick/shared";
import { QUICK_MAX_TICKETS } from "@/domains/beta-quick/shared";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import { ArrowLeft, InstagramIcon, MoreVerticalIcon, SnapchatIcon } from "@/components/icons";
import { COUNTRY_CODES } from "@/lib/country-codes";
import { ContactFields, DEFAULT_COUNTRY_ISO2, QuantityStepper, composeQuickPhone } from "./flow-fields";
import { EventIntentView, EventPoster, SECONDARY_BUTTON_CLASS } from "./event-pieces";
import { EventRequestSection } from "./event-request";

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
 * Home. Deliberately shows tonight only — the whole board lives behind
 * "See all" on `/upcoming`. The old `/member` events tab opened with every
 * upcoming night at once, which buried the two things people actually come
 * here to do.
 */
export function AppHome({
  tonight,
  tonightDay,
  waitlist,
  activity,
}: {
  tonight: BetaEvent[];
  tonightDay: BetaWeekday;
  waitlist: QuickWaitlistEntry[];
  activity: GoActivityEntry[];
}) {
  const [selected, setSelected] = useState<{ event: BetaEvent; day: BetaWeekday } | null>(null);
  const [editing, setEditing] = useState<QuickWaitlistEntry | null>(null);
  const hasTonight = tonight.length > 0;

  if (editing) {
    return <WaitlistEditView entry={editing} onBack={() => setEditing(null)} />;
  }

  if (selected) {
    return (
      <EventIntentView
        event={selected.event}
        day={selected.day}
        onBack={() => setSelected(null)}
      />
    );
  }

  const sellActivity = activity.filter((a) => a.intent === "sell");
  const activeSells = sellActivity.filter(
    (a) => a.status !== "done" && a.status !== "cancelled" && !isPastNightlife(a.createdAt),
  );
  const pastUnsoldSells = sellActivity.filter(
    (a) => a.status !== "done" && a.status !== "cancelled" && isPastNightlife(a.createdAt),
  );
  const doneSells = sellActivity.filter((a) => a.status === "done");
  const totalProceeds = doneSells.reduce((sum, a) => sum + (a.proceedsCad ?? 0), 0);
  const totalNet = doneSells.reduce((sum, a) => sum + (a.netVsPaidCad ?? 0), 0);

  return (
    <>
      <header className="relative pt-3">
        <h1 className="headline text-[32px] leading-[1.12] tracking-tight sm:text-[36px]">
          DON&apos;T PANIC IF TICKETS ARE SOLD OUT
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Buy and sell sold-out tickets fast. Secure matching between buyers and sellers, we
          refund you in case of issues.
        </p>
      </header>

      {waitlist.length > 0 && (
        <section className="relative mt-8">
          <p className="section-header text-[11px] text-muted">Your waitlist</p>
          <ul className="mt-4 flex flex-col gap-4">
            {waitlist.map((entry) => (
              <li key={entry.leadId} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(entry)}
                  className="flex w-full items-center justify-between gap-3 rounded-[16px] bg-[#17171a] px-4 py-3.5 text-left shadow-[0_7px_0_0_#c9b400,0_12px_28px_rgba(255,229,0,0.14)] transition-transform active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">{entry.eventName}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      ×{entry.quantity}
                      {entry.dormant
                        ? " · paused — reactivate to get holds again"
                        : entry.activeOfferId
                          ? " · ticket held for you — claim / pay"
                          : entry.status === "matched"
                            ? " · matched — we’ll message you"
                            : entry.status === "done"
                              ? " · completed"
                              : " · tap to edit · we’ll hold a ticket exclusively for you"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[20px] font-bold tabular-nums text-[#ffe500]">
                      #{entry.position}
                    </p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                      in line
                    </p>
                  </div>
                </button>
                {entry.activeOfferId && (
                  <Link
                    href={`/offer/${entry.activeOfferId}`}
                    className={`${BUTTON_CLASS} min-h-[44px] text-[14px]`}
                  >
                    Open payment / claim
                  </Link>
                )}
                {entry.dormant && !entry.activeOfferId && (
                  <ReactivateSeatButton seatKey={`go:${entry.leadId}`} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(activeSells.length > 0 || pastUnsoldSells.length > 0 || doneSells.length > 0) && (
        <section className="relative mt-8">
          {activeSells.length > 0 && (
            <>
              <p className="section-header text-[11px] text-muted">Your tickets for sale</p>
              <ul className="mt-3 flex flex-col gap-2">
                {activeSells.map((entry) => (
                  <SellListingRow key={entry.leadId} entry={entry} />
                ))}
              </ul>
            </>
          )}

          {pastUnsoldSells.length > 0 && (
            <div className={activeSells.length > 0 ? "mt-3" : ""}>
              <PastUnsoldSellNotice pastUnsoldSells={pastUnsoldSells} />
            </div>
          )}

          {doneSells.length > 0 && (
            <p className="mt-3 text-[12.5px] text-muted">
              Sold so far: ${totalProceeds.toFixed(0)} received
              {totalNet !== 0
                ? ` (${totalNet > 0 ? "+" : ""}$${totalNet.toFixed(0)} vs what you paid)`
                : ""}
              .
            </p>
          )}
        </section>
      )}

      <section className="relative mt-10 flex flex-col gap-3">
        <p className="section-header text-[11px] text-muted">What do you need?</p>
        <Link href="/buy" className={`${BUTTON_CLASS} min-h-[64px] text-[17px]`}>
          I need a ticket
        </Link>
        <Link href="/sell" className={`${SECONDARY_BUTTON_CLASS} min-h-[64px] text-[17px]`}>
          I have a ticket to sell
        </Link>
      </section>

      <section className="relative mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <p className="section-header text-[11px] text-muted">
            {hasTonight ? `Tonight · ${formatBetaEventWhenShort(tonightDay)}` : "Tonight"}
          </p>
          <Link
            href="/upcoming"
            className="shrink-0 text-[12.5px] font-semibold text-[#ffe500] transition-opacity hover:opacity-80"
          >
            See all events
          </Link>
        </div>

        {hasTonight ? (
          <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6">
            {tonight.map((event) => (
              <EventPoster
                key={event.slug}
                event={event}
                day={tonightDay}
                onSelect={() => setSelected({ event, day: tonightDay })}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            Nothing running tonight.{" "}
            <Link href="/upcoming" className="font-semibold text-ink underline decoration-dotted underline-offset-4">
              See what&apos;s coming up
            </Link>
            .
          </p>
        )}

        <div className="mt-4">
          <EventRequestSection />
        </div>
      </section>

      <footer className="relative mt-auto flex items-center justify-center gap-3 pt-12">
        <a
          href={BETA_SOCIALS.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="transition-transform hover:scale-105"
        >
          <InstagramIcon className="h-8 w-8" />
        </a>
        <a
          href={BETA_SOCIALS.snapchat}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Snapchat"
          className="transition-transform hover:scale-105"
        >
          <SnapchatIcon className="h-8 w-8" />
        </a>
      </footer>
    </>
  );
}

function ReactivateSeatButton({ seatKey }: { seatKey: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className={`${SECONDARY_BUTTON_CLASS} min-h-[44px] text-[14px]`}
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await buyerReactivateSeatAction(seatKey);
            if (r.error) setError(r.error);
            else router.refresh();
          });
        }}
      >
        {pending ? "…" : "Reactivate waitlist seat"}
      </button>
      {error && (
        <p role="alert" className="text-[12.5px] text-urgency">
          {error}
        </p>
      )}
    </div>
  );
}

function SellListingRow({ entry }: { entry: GoActivityEntry }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onRemove() {
    const ok = window.confirm(
      entry.status === "done"
        ? `Remove this sold ${entry.eventName} ticket from your list?`
        : `Remove your ${entry.eventName} ticket listing? Buyers won’t see it anymore.`,
    );
    if (!ok) {
      setMenuOpen(false);
      return;
    }
    setError(null);
    start(async () => {
      const result = await removeSellLeadAction(entry.leadId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMenuOpen(false);
      router.refresh();
    });
  }

  return (
    <li className="relative rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold text-ink">{entry.eventName}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            ×{entry.quantity}
            {entry.askEach != null ? ` · $${entry.askEach.toFixed(0)} each` : ""}
            {entry.saleStage === "payout_released"
              ? " · sold · payment released"
              : entry.saleStage === "awaiting_transfer"
                ? " · sold — transfer the ticket"
                : entry.status === "done"
                  ? " · sold"
                  : entry.status === "matched"
                    ? " · matched"
                    : " · listed"}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {entry.status === "done" && entry.proceedsCad != null && (
            <p className="text-right text-[13px] font-semibold tabular-nums text-ink">
              ${entry.proceedsCad.toFixed(0)}
              {entry.netVsPaidCad != null && entry.netVsPaidCad !== 0 && (
                <span className="mt-0.5 block text-[11px] font-medium text-muted">
                  {entry.netVsPaidCad > 0 ? "+" : ""}
                  ${entry.netVsPaidCad.toFixed(0)} vs paid
                </span>
              )}
            </p>
          )}
          <div className="relative">
            <button
              type="button"
              aria-label="Listing options"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              disabled={pending}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-50"
            >
              <MoreVerticalIcon className="h-5 w-5" />
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-9 z-30 min-w-[148px] overflow-hidden rounded-[12px] border border-white/12 bg-[#1c1c20] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={pending}
                    onClick={onRemove}
                    className="flex w-full px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-urgency hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    {pending ? "Removing…" : "Remove"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[12.5px] text-urgency">
          {error}
        </p>
      )}
    </li>
  );
}

function PastUnsoldSellNotice({
  pastUnsoldSells,
}: {
  pastUnsoldSells: GoActivityEntry[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dismissPending, startDismiss] = useTransition();

  if (dismissed || pastUnsoldSells.length === 0) return null;

  const totalTickets = pastUnsoldSells.reduce((sum, s) => sum + s.quantity, 0);
  const uniqueEvents = [...new Set(pastUnsoldSells.map((s) => s.eventName))];
  const eventsLabel = uniqueEvents.join(", ");

  function handleDismiss() {
    setDismissed(true);
    startDismiss(async () => {
      const ids = pastUnsoldSells.map((s) => s.leadId);
      await dismissPastSellLeadsAction(ids);
      router.refresh();
    });
  }

  if (!expanded) {
    return (
      <div
        className="flex w-full items-center gap-2 rounded-[16px] border border-[#6ee1ff]/35 bg-[#6ee1ff]/[0.06] p-3.5"
        role="status"
      >
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-label="Notice: Unsold tickets from last night — tap to view details"
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-90 active:scale-[0.99]"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6ee1ff]/20 text-[15px] font-black text-[#6ee1ff]"
          >
            !
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">
              Notice: Unsold tickets from last night
            </p>
            <p className="truncate text-[12px] text-muted">
              {eventsLabel} ({totalTickets} {totalTickets === 1 ? "ticket" : "tickets"})
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={dismissPending}
            className="rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#6ee1ff] transition-colors hover:bg-[#6ee1ff]/10 disabled:opacity-50"
          >
            {dismissPending ? "…" : "Got it"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="pr-0.5 text-[12.5px] font-semibold text-[#6ee1ff]/80 hover:text-[#6ee1ff]"
          >
            View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Unsold tickets notice"
      className="rounded-[16px] border border-[#6ee1ff]/35 bg-[#6ee1ff]/[0.06] p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6ee1ff]/20 text-[14px] font-black text-[#6ee1ff]"
          >
            !
          </span>
          <h3 className="text-[15px] font-bold leading-snug text-ink sm:text-[16px]">
            There weren&apos;t enough buyers for your tickets last night!
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="shrink-0 rounded-full p-1 text-[13px] text-muted transition-colors hover:text-ink"
          aria-label="Collapse message"
        >
          ✕
        </button>
      </div>

      <div className="mt-3.5 space-y-1.5 rounded-[12px] border border-white/10 bg-transparent p-3 text-[13px]">
        {pastUnsoldSells.map((entry) => (
          <div key={entry.leadId} className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink">{entry.eventName}</span>
            <span className="tabular-nums text-muted">
              ×{entry.quantity}
              {entry.askEach != null ? ` · $${entry.askEach.toFixed(0)} each` : ""}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        We&apos;re sorry we couldn&apos;t find a buyer for your {eventsLabel} ticket
        {totalTickets > 1 ? "s" : ""} before the night wrapped up. Demand moves fast in Montreal
        nightlife, and last night the buyer queue ran out before your listing was reached.
      </p>

      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        We know it sucks when an extra ticket goes unused — we&apos;re constantly growing the buyer
        network so more tickets find homes. Thanks for listing with us! Next time you have an extra,
        post early and we&apos;ll do our best to match you.
      </p>

      <div className="mt-4 flex items-center justify-end gap-3 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[13px] font-semibold text-muted transition-colors hover:text-ink"
        >
          Close
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissPending}
          className="rounded-[10px] border border-[#6ee1ff]/40 bg-[#6ee1ff]/15 px-4 py-2 text-[13px] font-semibold text-[#6ee1ff] transition-colors hover:bg-[#6ee1ff]/25 disabled:opacity-50"
        >
          {dismissPending ? "Removing…" : "Got it"}
        </button>
      </div>
    </div>
  );
}

function WaitlistEditView({
  entry,
  onBack,
}: {
  entry: QuickWaitlistEntry;
  onBack: () => void;
}) {
  const router = useRouter();
  const savedPhone = splitSavedPhone(entry.contactPhone);
  const [quantity, setQuantity] = useState(
    Math.min(QUICK_MAX_TICKETS, Math.max(1, entry.quantity)),
  );
  const [phoneCountry, setPhoneCountry] = useState(savedPhone.iso2);
  const [phoneNational, setPhoneNational] = useState(savedPhone.national);
  const [instagram, setInstagram] = useState(entry.contactInstagram ?? "");
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leavePending, startLeave] = useTransition();
  const [state, formAction, pending] = useActionState(
    updateWaitlistLeadAction,
    {} as QuickActionState,
  );

  const phone = composeQuickPhone(phoneCountry, phoneNational);
  const phoneOk = phoneNational.replace(/\D/g, "").length >= 7;
  const igOk = instagram.replace(/^@+/, "").trim().length >= 2;
  const canSave = phoneOk || igOk;

  useEffect(() => {
    if (state.ok) {
      onBack();
      router.refresh();
    }
  }, [state.ok, onBack, router]);

  function onLeave() {
    setLeaveError(null);
    startLeave(async () => {
      const result = await leaveWaitlistLeadAction(entry.leadId);
      if (result.error) {
        setLeaveError(result.error);
        return;
      }
      onBack();
      router.refresh();
    });
  }

  return (
    <div className="relative flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 self-start text-[13.5px] font-semibold text-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div>
        <p className="section-header text-[11px] text-muted">Your waitlist</p>
        <h1 className="headline mt-2 text-[28px] leading-[1.12] tracking-tight">{entry.eventName}</h1>
        <p className="mt-2 text-[14px] text-muted">
          You’re #{entry.position} in line
          {entry.status === "matched" ? " · matched" : ""}. Update your details anytime.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="leadId" value={entry.leadId} />
        <input type="hidden" name="quantity" value={quantity} />
        <input type="hidden" name="contactPhone" value={phone} />
        <input type="hidden" name="contactInstagram" value={instagram.replace(/^@+/, "").trim()} />

        <div>
          <p className="mb-3 text-[13.5px] font-semibold text-ink">How many tickets? (max {QUICK_MAX_TICKETS})</p>
          <QuantityStepper value={quantity} onChange={setQuantity} max={QUICK_MAX_TICKETS} />
        </div>

        <div>
          <p className="mb-3 text-[13.5px] font-semibold text-ink">How do we reach you?</p>
          <ContactFields
            phoneCountry={phoneCountry}
            phoneNational={phoneNational}
            instagram={instagram}
            onPhoneCountry={setPhoneCountry}
            onPhoneNational={setPhoneNational}
            onInstagram={setInstagram}
            hintAbove
            hint="Enter one of the contacts below."
          />
        </div>

        {(state.error || leaveError) && (
          <p role="alert" className="text-[13.5px] text-urgency">
            {state.error ?? leaveError}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSave || pending || leavePending}
          className={`${BUTTON_CLASS} w-full`}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <button
        type="button"
        onClick={onLeave}
        disabled={pending || leavePending}
        className="text-[14px] font-semibold text-urgency underline decoration-dotted underline-offset-4 disabled:opacity-50"
      >
        {leavePending ? "Leaving…" : "Leave this waitlist"}
      </button>

      <Link
        href={`/buy?event=${encodeURIComponent(entry.eventSlug)}`}
        className="text-center text-[13px] font-semibold text-muted underline decoration-dotted underline-offset-4"
      >
        Or update via “I need a ticket”
      </Link>
    </div>
  );
}
