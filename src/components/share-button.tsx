"use client";

import { useState } from "react";
import { ShareIcon } from "./icons";
import { ShareSheet } from "./share-sheet";

/**
 * Shared links carry ?ref=share so the landing event page can log
 * DATA_CAPTURE.md's share_link_opened — see events/[id]/page.tsx. Passing
 * `listingId` builds a listing-scoped link instead (CLAUDE.md § Phase 3:
 * "a shared listing link lands a new user directly on that listing") — the
 * event page reads `?listing=` to highlight the right card, and the `#listing-*`
 * fragment gets the browser to scroll to it natively, no extra JS needed.
 */
export function ShareButton({
  eventId,
  eventName,
  listingId,
  variant = "icon",
}: {
  eventId: string;
  eventName: string;
  listingId?: string;
  variant?: "icon" | "text";
}) {
  const [open, setOpen] = useState(false);

  const path = listingId
    ? `/events/${eventId}?listing=${listingId}&ref=share#listing-${listingId}`
    : `/events/${eventId}?ref=share`;

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Share this event"
          className="frosted flex h-11 w-11 items-center justify-center rounded-full border border-white/10"
        >
          <ShareIcon className="h-[19px] w-[19px]" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted"
        >
          <ShareIcon className="h-3.5 w-3.5" />
          Share
        </button>
      )}

      <ShareSheet
        open={open}
        onClose={() => setOpen(false)}
        eventId={eventId}
        listingId={listingId}
        url={typeof window !== "undefined" ? `${window.location.origin}${path}` : ""}
        title={eventName}
      />
    </>
  );
}
