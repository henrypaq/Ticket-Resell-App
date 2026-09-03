"use client";

import { useState } from "react";
import { BottomSheet } from "./bottom-sheet";
import { CheckIcon, ChevronRight, LinkIcon, MapPinFillIcon, PinIcon } from "./icons";

/**
 * Deep-links to Google Maps and Apple Maps need only an address string — no
 * API key, no lat/lng lookup. That's the whole mechanism: build a search URL
 * for each and hand off. What's shown inline (the pin graphic) is honestly a
 * placeholder, not a live map tile — there's no mapping SDK/key wired in, and
 * a fake-looking live map would be worse than a plain one.
 */
function mapsUrls(venue: string, city: string) {
  const address = encodeURIComponent(`${venue}, ${city}`);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${address}`,
    apple: `https://maps.apple.com/?q=${address}`,
  };
}

export function LocationTrigger({
  venue,
  city,
  variant = "row",
}: {
  venue: string;
  city: string;
  variant?: "row" | "card";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "row" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2.5 py-2 text-left"
        >
          <PinIcon className="h-[18px] w-[18px] shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">
            {venue}, {city}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="surface flex w-full items-center gap-3.5 rounded-2xl p-4 text-left"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5">
            <MapPinFillIcon className="h-6 w-6 text-ink" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-ink">{venue}</span>
            <span className="block truncate text-[13px] text-muted">{city} · Get directions</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
        </button>
      )}

      <LocationSheet open={open} onClose={() => setOpen(false)} venue={venue} city={city} />
    </>
  );
}

function LocationSheet({
  open,
  onClose,
  venue,
  city,
}: {
  open: boolean;
  onClose: () => void;
  venue: string;
  city: string;
}) {
  const [copied, setCopied] = useState(false);
  const urls = mapsUrls(venue, city);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(`${venue}, ${city}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permission denied or unsupported.
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Location">
      <div className="flex h-32 items-center justify-center rounded-2xl border border-hairline bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:16px_16px]">
        <MapPinFillIcon className="h-8 w-8 text-ink" />
      </div>

      <p className="mt-4 text-[16px] font-bold text-ink">{venue}</p>
      <p className="mt-0.5 text-[13.5px] text-muted">{city}</p>

      <div className="mt-5 space-y-2.5">
        <a
          href={urls.google}
          target="_blank"
          rel="noreferrer noopener"
          className="flex w-full items-center justify-center rounded-full bg-ink px-5 py-3.5 text-[14.5px] font-bold text-base"
        >
          Open in Google Maps
        </a>
        <a
          href={urls.apple}
          target="_blank"
          rel="noreferrer noopener"
          className="flex w-full items-center justify-center rounded-full border border-hairline px-5 py-3.5 text-[14.5px] font-bold text-ink"
        >
          Open in Apple Maps
        </a>
        <button
          type="button"
          onClick={copyAddress}
          className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium text-muted"
        >
          {copied ? <CheckIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
          {copied ? "Address copied" : "Copy address"}
        </button>
      </div>
    </BottomSheet>
  );
}
