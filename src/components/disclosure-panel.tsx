import { formatCad } from "@/lib/format";
import { ShieldIcon } from "./icons";

/**
 * Pre-purchase disclosure — CLAUDE_1 hard constraint 3.
 *
 * Renders the four required facts: the original ticket price, the event
 * details, that this is a resale rather than a primary sale, and the itemised
 * fee breakdown. STYLE.md is explicit that this is laid out as part of the
 * page, not shrunk into small print at the bottom.
 */
export function DisclosurePanel({
  originalPrice,
  ticketPrice,
  serviceFee,
  serviceFeeLabel,
  eventName,
  venue,
  startsAt,
  verificationTier,
}: {
  originalPrice: number;
  ticketPrice: number;
  serviceFee: number;
  serviceFeeLabel: string;
  eventName: string;
  venue: string;
  startsAt: string;
  verificationTier: "A" | "B";
}) {
  const total = Math.round((ticketPrice + serviceFee + Number.EPSILON) * 100) / 100;

  return (
    <section className="surface rounded-2xl p-4" aria-label="Price and resale disclosure">
      <div className="flex items-center gap-2">
        <span className="pill-quiet px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
          Resale
        </span>
        <p className="text-[13px] text-muted">Sold by a fan, not the event organiser</p>
      </div>

      <dl className="mt-4 space-y-2.5 text-[14px]">
        <Row label="Original ticket price" value={formatCad(originalPrice)} muted />
        <Row label="Ticket price" value={formatCad(ticketPrice)} />
        <Row label={serviceFeeLabel} value={formatCad(serviceFee)} />
        <div className="border-t border-hairline pt-2.5">
          <Row label="Total" value={formatCad(total)} strong />
        </div>
      </dl>

      <p className="mt-4 border-t border-hairline pt-3 text-[12.5px] leading-relaxed text-muted">
        {eventName} · {venue} · {startsAt}. Resale is capped at the original ticket price. The{" "}
        {serviceFeeLabel.toLowerCase()} is a flat charge shown separately from the ticket price.
      </p>

      <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
        <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {verificationTier === "A"
            ? "Tier A event — this ticket will be transferred through the original ticketing platform once automated verification ships."
            : "Tier B event — the seller has attested they hold a valid ticket. Verify the handover in person."}
        </span>
      </p>
    </section>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? "text-muted" : strong ? "font-bold" : ""}>{label}</dt>
      <dd className={`tabular-nums ${muted ? "text-muted line-through" : strong ? "font-bold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
