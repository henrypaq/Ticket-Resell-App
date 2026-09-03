import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, type SessionUser } from "@/domains/users/session";

export type AdminUser = SessionUser & { isAdmin: true };

export async function getAdminUser(): Promise<AdminUser | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.is_admin) return null;
  return { ...user, isAdmin: true };
}

/**
 * Every admin route and every admin action calls this. The console being
 * reachable is never what grants the capability — SECURITY.md § authorization:
 * authorize on every request, server-side.
 *
 * 404s rather than 403s so the console's existence isn't advertised to a
 * non-admin probing for it.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) notFound();
  return admin;
}
