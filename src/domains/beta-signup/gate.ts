import "server-only";

import { redirect } from "next/navigation";
import { loadBetaProfile } from "./actions";
import type { BetaSignupProfile } from "./shared";

/**
 * The app's entry gate. Membership is a cookie holding `beta_members.id`, and
 * only a cookie that still resolves to a live row counts — a stale or deleted
 * id sends you back to `/`, which runs the join flow.
 *
 * Every gated page calls this itself rather than sharing a layout-level check.
 * A layout renders before its child page, so an `await` + redirect there wins
 * the race against anything the page wanted to do with the request first —
 * this repo already lost a next-path that way (see the note that used to live
 * in the retired `(app)/layout.tsx`, now `src/_legacy/app-routes/layout.tsx`).
 */
export async function requireMember(): Promise<BetaSignupProfile> {
  const profile = await loadBetaProfile();
  if (!profile) redirect("/");
  return profile;
}
