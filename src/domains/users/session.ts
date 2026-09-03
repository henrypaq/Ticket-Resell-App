import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/next-path";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  handle: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  // getUser() revalidates the token with Supabase Auth rather than trusting the
  // cookie's contents — SECURITY.md § authorization.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, handle, email")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    displayName: profile?.display_name ?? (user.email ?? "there").split("@")[0],
    handle: profile?.handle ?? "",
  };
}

/**
 * `nextPath` is where to send the user back to after signing in — pass it
 * from a page a signed-out visitor might land on directly (a shared link)
 * so the redirect through /login doesn't strand them on the home feed.
 * Most callers don't need it; it only matters for entry points meant to be
 * shared outside the app.
 */
export async function requireSessionUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const safeNext = sanitizeNextPath(nextPath);
    redirect(safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login");
  }
  return user;
}
