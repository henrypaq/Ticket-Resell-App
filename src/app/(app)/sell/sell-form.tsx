"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createListingAction, type ListingFormState } from "@/domains/listings/actions";
import { SERVICE_FEE_CAD, SERVICE_FEE_LABEL } from "@/lib/compliance/fees";
import { formatCad } from "@/lib/compliance/pricing";
import { BarcodeScanButton } from "@/components/barcode-scanner";

type EventOption = {
  id: string;
  name: string;
  venue: string;
  originalPrice: number;
  requiresTicketEvidence: boolean;
};

export function SellForm({
  events,
  defaultEventId,
  defaultTicketBarcode,
}: {
  events: EventOption[];
  defaultEventId?: string;
  /** From the global scan button (GlobalScanButton → /sell?scannedBarcode=...). */
  defaultTicketBarcode?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ListingFormState, FormData>(
    async (prev, formData) => {
      const result = await createListingAction(prev, formData);
      // Stay on the page if there's a non-fatal evidence-upload warning to
      // show — an error keeps the form as-is either way.
      if (!result.error && !result.evidenceWarning) router.push("/tickets");
      return result;
    },
    {},
  );

  const [eventId, setEventId] = useState(defaultEventId ?? events[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [ticketBarcode, setTicketBarcode] = useState(defaultTicketBarcode ?? "");

  const selected = events.find((e) => e.id === eventId);
  const cap = selected?.originalPrice ?? 0;
  const requiresTicketId = selected?.requiresTicketEvidence ?? true;
  const numericPrice = Number(price);
  // Mirrors the server rule for immediate feedback. The server and the database
  // both re-check it — this is convenience, never the enforcement point.
  const overCap = price !== "" && Number.isFinite(numericPrice) && numericPrice > cap;

  if (events.length === 0) {
    return (
      <p className="surface rounded-2xl px-5 py-8 text-center text-[14px] text-muted">
        No events are open for resale yet. Request one below and check back once it&apos;s approved.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {defaultTicketBarcode && (
        <p className="rounded-2xl border border-hairline px-4 py-3 text-[13px] text-muted">
          Ticket scanned. Pick the event below to finish posting it.
        </p>
      )}

      <div>
        <label htmlFor="eventId" className="block text-[13px] font-medium text-muted">
          Event
        </label>
        <select
          id="eventId"
          name="eventId"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="pill mt-2 w-full appearance-none px-5 py-3.5 text-[16px] text-ink outline-none focus:border-white/25"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id} className="bg-card">
              {e.name} — {e.venue}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[12.5px] text-muted">
          Only admin-approved events are open for resale. If yours isn&apos;t listed, request it
          below.
        </p>
      </div>

      <div>
        <label htmlFor="price" className="block text-[13px] font-medium text-muted">
          Your price
        </label>
        <div className="pill mt-2 flex items-center gap-2 px-5 py-3.5 focus-within:border-white/25">
          <span className="text-[16px] text-muted">$</span>
          <input
            id="price"
            name="price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            max={cap}
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={cap.toFixed(2)}
            aria-describedby="price-cap"
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
          />
          <span className="text-[13px] text-muted">CAD</span>
        </div>

        <p id="price-cap" className="mt-2 text-[12.5px] text-muted">
          Capped at {formatCad(cap)} — the ticket&apos;s original price.
        </p>

        {overCap && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-urgency">
            {formatCad(numericPrice)} is above the {formatCad(cap)} cap. Lower it to continue.
          </p>
        )}
      </div>

      {price !== "" && !overCap && numericPrice >= 0 && (
        <div className="surface rounded-2xl p-4">
          <h3 className="section-header text-[12px]">What the buyer sees</h3>
          <dl className="mt-3 space-y-2 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-muted">Ticket price</dt>
              <dd className="tabular-nums">{formatCad(numericPrice)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{SERVICE_FEE_LABEL}</dt>
              <dd className="tabular-nums">{formatCad(SERVICE_FEE_CAD)}</dd>
            </div>
            <div className="flex justify-between border-t border-hairline pt-2 font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCad(numericPrice + SERVICE_FEE_CAD)}</dd>
            </div>
          </dl>
        </div>
      )}

      {requiresTicketId && (
        <div>
          <label htmlFor="ticketBarcode" className="block text-[13px] font-medium text-muted">
            Ticket barcode or ID
          </label>
          <div className="pill mt-2 flex items-center gap-2 px-5 py-3.5 focus-within:border-white/25">
            <input
              id="ticketBarcode"
              name="ticketBarcode"
              type="text"
              required
              value={ticketBarcode}
              onChange={(e) => setTicketBarcode(e.target.value)}
              placeholder="Scan or type it in"
              className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
            />
            <BarcodeScanButton onDetected={setTicketBarcode} />
          </div>
          <p className="mt-2 text-[12.5px] text-muted">
            Checked against every other listing so the same ticket can&apos;t be sold twice.
          </p>

          <label htmlFor="ticketImage" className="mt-4 block text-[13px] font-medium text-muted">
            Photo of your ticket (optional)
          </label>
          <input
            id="ticketImage"
            name="ticketImage"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="pill mt-2 w-full px-5 py-3 text-[13.5px] text-ink file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-ink"
          />
          <p className="mt-2 text-[12.5px] text-muted">
            Kept private — only used if a buyer disputes the purchase later.
          </p>
        </div>
      )}

      <label className="flex items-start gap-3 rounded-2xl border border-hairline p-4">
        <input
          type="checkbox"
          name="attestation"
          required
          className="mt-0.5 h-5 w-5 shrink-0 accent-white"
        />
        <span className="text-[13.5px] leading-relaxed text-muted">
          I confirm I hold a valid ticket for this event and that it has not been sold, transferred,
          or used.{" "}
          {requiresTicketId
            ? "The ticket ID above is checked for duplicates before this goes live."
            : "Automated verification arrives in a later release — until then this attestation is what the listing rests on."}
        </span>
      </label>

      {state.evidenceWarning && (
        <p className="rounded-2xl border border-hairline px-4 py-3 text-[13.5px] text-muted">
          Your listing is live. {state.evidenceWarning}{" "}
          <button type="button" onClick={() => router.push("/tickets")} className="font-semibold underline">
            Continue
          </button>
        </p>
      )}

      {state.error && (
        <p role="alert" className="rounded-2xl border border-urgency/30 bg-urgency/10 px-4 py-3 text-[13.5px] text-urgency">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || overCap}
        className="w-full rounded-full bg-ink px-5 py-4 text-[15px] font-bold text-base disabled:opacity-50"
      >
        {pending ? "Posting…" : "Post listing"}
      </button>
    </form>
  );
}
