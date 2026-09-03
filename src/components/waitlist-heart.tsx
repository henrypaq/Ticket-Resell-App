"use client";

import { useOptimistic, startTransition } from "react";
import { toggleWaitlistAction } from "@/domains/waitlist/actions";
import { HeartIcon } from "./icons";

/**
 * The heart is the like/waitlist toggle — liking an event is exactly what the
 * waitlist already means in Phase 1 (get notified when a ticket drops), so
 * this wires straight to that primitive rather than inventing a Phase 3
 * favourites entity. Liked events surface on /profile.
 */
export function WaitlistHeart({
  eventId,
  joined,
  variant = "row",
}: {
  eventId: string;
  joined: boolean;
  /** "row" sits beside plain text in a list row, on the app background — no
   * frosted backing needed. "hero" sits on the event page banner beside the
   * share button and needs to match its size. */
  variant?: "row" | "hero";
}) {
  const [optimisticJoined, setOptimisticJoined] = useOptimistic(joined);

  return (
    <form
      action={(formData: FormData) => {
        startTransition(() => setOptimisticJoined(!optimisticJoined));
        return toggleWaitlistAction(formData);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="joined" value={String(optimisticJoined)} />
      {variant === "hero" ? (
        <button
          type="submit"
          aria-pressed={optimisticJoined}
          aria-label={optimisticJoined ? "Unlike this event" : "Like this event"}
          className={`frosted flex h-11 w-11 items-center justify-center rounded-full border border-white/15 transition-colors ${
            optimisticJoined ? "text-ink" : "text-white/80"
          }`}
        >
          <HeartIcon className="h-5 w-5" filled={optimisticJoined} />
        </button>
      ) : (
        <button
          type="submit"
          aria-pressed={optimisticJoined}
          aria-label={optimisticJoined ? "Unlike this event" : "Like this event"}
          className={`flex h-8 w-8 items-center justify-center transition-colors ${
            optimisticJoined ? "text-ink" : "text-muted"
          }`}
        >
          <HeartIcon className="h-5 w-5" filled={optimisticJoined} />
        </button>
      )}
    </form>
  );
}
