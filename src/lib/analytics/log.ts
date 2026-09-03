import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append-only analytics log (DATA_CAPTURE.md § architecture).
 *
 * The taxonomy is closed on purpose: every type below maps to a stated question
 * the data answers. Adding one means asking what it's for first — Law 25 data
 * minimisation, not a style preference.
 */
export type AnalyticsEventType =
  // Demand signal
  | "event_page_view"
  | "waitlist_joined"
  | "waitlist_left"
  | "listing_viewed"
  | "search_no_results"
  | "listing_created"
  | "event_requested"
  | "event_approved"
  // Transaction outcomes (wired as Phase 2 builds them out)
  | "purchase_initiated"
  | "purchase_completed"
  | "purchase_disputed"
  | "purchase_refunded"
  | "listing_expired_unsold"
  // Trust / fraud
  | "verification_tier_a_success"
  | "verification_tier_b_used"
  | "duplicate_listing_flagged"
  // Social / virality
  | "share_link_created"
  | "share_link_opened"
  | "friend_added"
  | "attendance_confirmed"
  // Account
  | "signup_completed"
  | "login";

type LogInput = {
  type: AnalyticsEventType;
  userId?: string | null;
  eventRefId?: string | null;
  listingRefId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Never throws. Analytics is not allowed to break a user-facing flow — a failed
 * insert is logged and swallowed.
 */
export async function logEvent(input: LogInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("analytics_events").insert({
      event_type: input.type,
      user_id: input.userId ?? null,
      event_ref_id: input.eventRefId ?? null,
      listing_ref_id: input.listingRefId ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.warn(JSON.stringify({ level: "warn", msg: "analytics_insert_failed", type: input.type, error: error.message }));
    }
  } catch (err) {
    console.warn(JSON.stringify({ level: "warn", msg: "analytics_insert_threw", type: input.type, error: String(err) }));
  }
}
