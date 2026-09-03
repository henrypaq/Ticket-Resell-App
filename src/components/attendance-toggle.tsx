"use client";

import { useOptimistic, startTransition } from "react";
import { toggleAttendanceAction } from "@/domains/social/actions";
import { CheckIcon } from "./icons";

/** "I'm going" — the attendance-confirmation signal from CLAUDE.md § Phase 3, visible to followers. */
export function AttendanceToggle({ eventId, going }: { eventId: string; going: boolean }) {
  const [optimisticGoing, setOptimisticGoing] = useOptimistic(going);

  return (
    <form
      action={(formData: FormData) => {
        startTransition(() => setOptimisticGoing(!optimisticGoing));
        return toggleAttendanceAction(formData);
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="going" value={String(optimisticGoing)} />
      <button
        type="submit"
        aria-pressed={optimisticGoing}
        className={`flex items-center justify-center gap-1.5 rounded-full border px-5 py-3.5 text-[15px] font-bold ${
          optimisticGoing ? "border-hairline text-ink" : "border-hairline text-muted"
        }`}
      >
        {optimisticGoing && <CheckIcon className="h-4 w-4" />}
        {optimisticGoing ? "You're going" : "I'm going"}
      </button>
    </form>
  );
}
