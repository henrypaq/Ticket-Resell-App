import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, supabaseSecretKey } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so it is used only for operations that are
 * legitimately not "this user acting on their own rows":
 *
 *  - reading event_authorizations during price validation (no client role can
 *    see that table at all, by design — SECURITY.md § authorization)
 *  - fanning out match notifications to *other* users' notification rows
 *
 * The `server-only` import makes it a build error to pull this into a client
 * component.
 */
export function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL, supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
