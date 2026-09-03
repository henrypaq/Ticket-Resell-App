"use client";

import { useOptimistic, startTransition } from "react";
import { toggleFollowAction } from "@/domains/social/actions";

/** Mirrors the WaitlistHeart pattern: optimistic toggle over a plain form action. */
export function FollowButton({
  followeeId,
  handle,
  following,
}: {
  followeeId: string;
  handle: string;
  following: boolean;
}) {
  const [optimisticFollowing, setOptimisticFollowing] = useOptimistic(following);

  return (
    <form
      action={(formData: FormData) => {
        startTransition(() => setOptimisticFollowing(!optimisticFollowing));
        return toggleFollowAction(formData);
      }}
    >
      <input type="hidden" name="followeeId" value={followeeId} />
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="following" value={String(optimisticFollowing)} />
      <button
        type="submit"
        aria-pressed={optimisticFollowing}
        className={
          optimisticFollowing
            ? "rounded-full border border-hairline px-5 py-2.5 text-[14px] font-semibold text-muted"
            : "rounded-full bg-ink px-5 py-2.5 text-[14px] font-bold text-base"
        }
      >
        {optimisticFollowing ? "Following" : "Follow"}
      </button>
    </form>
  );
}
