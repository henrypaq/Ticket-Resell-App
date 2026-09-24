import "server-only";

import { z } from "zod";
import { notifyAdminsOfQuickLead } from "@/domains/admin-alerts/service";
import { upsertGoContact } from "@/domains/beta-go/contacts";
import { createUnitsFromSellLead, allocateAvailableUnitsForEvent, getLiveOfferIdForBuyLead } from "@/domains/beta-matching/service";
import { notifyBuyLead, notifySellLead } from "@/domains/beta-matching/notify";
import {
  getFakeFrontMap,
  listUnifiedQueueSeats,
  positionInSeats,
} from "@/domains/beta-queue/unified";
import { ACQUISITION_CHANNELS } from "@/lib/beta-acquisition";
import { betaEventBySlug } from "@/lib/beta-events";
import { getBetaEventBySlug, loadBetaCatalog } from "@/domains/beta-events/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTicketEvidenceFile, encodeEvidencePaths } from "@/lib/verification/ticket-evidence";
import type { QuickWaitlistEntry, GoActivityEntry } from "./shared";
import { QUICK_MAX_TICKETS } from "./shared";

export type { QuickWaitlistEntry, GoActivityEntry } from "./shared";
export { QUICK_MAX_TICKETS } from "./shared";

const contactRefine = (
  value: { contactPhone?: string; contactInstagram?: string },
  ctx: z.RefinementCtx,
) => {
  const phoneOk = (value.contactPhone ?? "").replace(/\D/g, "").length >= 7;
  const igOk = (value.contactInstagram ?? "").length >= 2;
  if (!phoneOk && !igOk) {
    ctx.addIssue({
      code: "custom",
      message: "Add a phone number or Instagram so we can reach you.",
      path: ["contactPhone"],
    });
  }
};

export const quickBuySchema = z
  .object({
    eventSlug: z.string().trim().min(1).max(80),
    quantity: z.coerce.number().int().min(1).max(QUICK_MAX_TICKETS),
    contactPhone: z.string().trim().max(30).optional().default(""),
    contactInstagram: z
      .string()
      .trim()
      .max(40)
      .transform((v) => v.replace(/^@+/, "").replace(/\s+/g, ""))
      .optional()
      .default(""),
    /** Ticket-transfer recipient — required for Café Campus and fixed-price events. */
    transferFirstName: z.string().trim().max(80).optional().default(""),
    transferLastName: z.string().trim().max(80).optional().default(""),
    transferEmail: z
      .string()
      .trim()
      .max(320)
      .optional()
      .default("")
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email."),
    /** Optional buy-side ceiling — allocator skips units above this. */
    maxPriceEach: z.preprocess((v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    }, z.number().min(0).max(5000).optional()),
    acquisitionChannel: z.enum(ACQUISITION_CHANNELS).optional(),
    /**
     * Last-touch tag from the link that produced this lead (story, campaign).
     * Free-form by design — a new story link shouldn't need a code change —
     * so it's shape-validated here rather than enum-checked.
     */
    landingSrc: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]{0,39}$/i)
      .optional(),
  })
  .superRefine(contactRefine)
  .superRefine((value, ctx) => {
    // Supported/live check happens in submit via loadBetaCatalog (DB + static).
    if (value.eventSlug === "cafe-campus") {
      if (!value.transferFirstName.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Enter your first name for the Café Campus ticket transfer.",
          path: ["transferFirstName"],
        });
      }
      if (!value.transferLastName.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Enter your last name for the Café Campus ticket transfer.",
          path: ["transferLastName"],
        });
      }
      if (!value.transferEmail.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Enter your email for the Café Campus ticket transfer.",
          path: ["transferEmail"],
        });
      }
    }
  });

export const quickSellSchema = z
  .object({
    eventSlug: z.string().trim().min(1).max(80),
    quantity: z.coerce.number().int().min(1).max(QUICK_MAX_TICKETS),
    paidEach: z.coerce.number().min(0).max(5000),
    askEach: z.coerce.number().min(0).max(5000),
    contactPhone: z.string().trim().max(30).optional().default(""),
    contactInstagram: z
      .string()
      .trim()
      .max(40)
      .transform((v) => v.replace(/^@+/, "").replace(/\s+/g, ""))
      .optional()
      .default(""),
    ticketShareUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .default("")
      .refine(
        (v) => v === "" || /^https?:\/\//i.test(v),
        "Paste a full link starting with https://",
      ),
    etransferName: z.string().trim().min(1, "Enter the Interac name.").max(120),
    etransferEmail: z
      .string()
      .trim()
      .max(320)
      .optional()
      .default("")
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email."),
    etransferPhone: z.string().trim().max(30).optional().default(""),
    sellerTermsAccepted: z.literal(true, {
      message: "Confirm the seller terms before submitting.",
    }),
    acquisitionChannel: z.enum(ACQUISITION_CHANNELS).optional(),
    /**
     * Last-touch tag from the link that produced this lead (story, campaign).
     * Free-form by design — a new story link shouldn't need a code change —
     * so it's shape-validated here rather than enum-checked.
     */
    landingSrc: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]{0,39}$/i)
      .optional(),
  })
  .superRefine(contactRefine)
  .superRefine((value, ctx) => {
    // Supported/live check happens in submit via loadBetaCatalog (DB + static).
    const etPhoneOk = (value.etransferPhone ?? "").replace(/\D/g, "").length >= 7;
    const etEmailOk = (value.etransferEmail ?? "").length > 3;
    if (!etPhoneOk && !etEmailOk) {
      ctx.addIssue({
        code: "custom",
        message: "Add an Interac email or phone.",
        path: ["etransferEmail"],
      });
    }
  });

/**
 * What `/ops` shows as a lead's Source. Last-touch wins: the point of the
 * event-specific story links is telling two links for the same event apart,
 * and a returning visitor's first-touch cookie is frozen from months ago.
 * Falls back to first-touch when the visit carried no tag, so an untagged
 * lead still says something.
 *
 * `beta_go_leads.acquisition_channel` is plain text with no check constraint
 * (0013), which is what lets a free-form campaign tag land here without a
 * migration. `beta_members.acquisition_channel` is constrained to the enum
 * (0020) and stays strictly first-touch — don't feed this to it.
 */
function leadSource(input: { landingSrc?: string; acquisitionChannel?: string }): string | null {
  return input.landingSrc ?? input.acquisitionChannel ?? null;
}

export type QuickBuyInput = z.infer<typeof quickBuySchema>;
export type QuickSellInput = z.infer<typeof quickSellSchema>;

export type QuickLeadResult =
  | { ok: true; id: string; contactId?: string; offerId?: string }
  | { ok: false; error: string };

/**
 * Can this visitor act on this lead? Three independent proofs, any one of
 * which is enough:
 *
 * - the lead hangs off the /go contact in their cookie;
 * - the lead id itself is in their buyer/seller cookie;
 * - the lead is stamped with their beta member id.
 *
 * The third one is what lets a member manage a listing from a second device or
 * after clearing cookies — without it, the home page would show them a listing
 * they're then told isn't theirs.
 */
function ownsLead(
  row: { id: string; contact_id: string | null; member_id: string | null },
  input: { contactId: string | null; allowedLeadIds: string[]; memberId?: string | null },
): boolean {
  if (input.contactId && row.contact_id === input.contactId) return true;
  if (input.allowedLeadIds.includes(row.id)) return true;
  if (input.memberId && row.member_id === input.memberId) return true;
  return false;
}

export async function submitQuickBuy(
  input: QuickBuyInput & { existingContactId?: string | null; memberId?: string | null },
): Promise<QuickLeadResult> {
  const listed = await getBetaEventBySlug(input.eventSlug);
  if (!listed?.supported) {
    return { ok: false, error: "Pick a supported event." };
  }

  const contactResult = await upsertGoContact({
    contactPhone: input.contactPhone,
    contactInstagram: input.contactInstagram,
    existingContactId: input.existingContactId,
    memberId: input.memberId,
  });
  if (!contactResult.ok) {
    return { ok: false, error: contactResult.error };
  }
  const contactId = contactResult.contact.id;
  const memberId = contactResult.contact.memberId;
  const phone = (input.contactPhone || "").trim() || contactResult.contact.contactPhone;
  const ig = (input.contactInstagram || "").trim() || contactResult.contact.contactInstagram;

  const admin = createAdminClient();

  // Same contact + event → update the open waitlist row instead of duplicating.
  const { data: existing } = await admin
    .from("beta_go_leads")
    .select("id, status")
    .eq("intent", "buy")
    .eq("contact_id", contactId)
    .eq("event_slug", input.eventSlug)
    .neq("status", "cancelled")
    .neq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Café Campus + fixed-price events need a named transfer recipient — ops
  // delivers those tickets manually to that inbox.
  const needsTransfer =
    input.eventSlug === "cafe-campus" || listed.fixedPriceEach != null;
  if (needsTransfer) {
    if (!input.transferFirstName.trim()) {
      return { ok: false, error: "Enter your first name for the ticket transfer." };
    }
    if (!input.transferLastName.trim()) {
      return { ok: false, error: "Enter your last name for the ticket transfer." };
    }
    if (!input.transferEmail.trim()) {
      return { ok: false, error: "Enter your email for the ticket transfer." };
    }
  }

  const transferFirstName = needsTransfer ? input.transferFirstName.trim() : "";
  const transferLastName = needsTransfer ? input.transferLastName.trim() : "";
  const transferEmail = needsTransfer
    ? input.transferEmail.trim().toLowerCase()
    : "";

  // Fixed-price inventory is fulfilled manually for now — never auto-hold.
  const manualQueueOnly = listed.fixedPriceEach != null;

  if (existing?.id) {
    const { error: updateError } = await admin
      .from("beta_go_leads")
      .update({
        quantity: input.quantity,
        contact_phone: phone || null,
        contact_instagram: ig || null,
        transfer_first_name: transferFirstName || null,
        transfer_last_name: transferLastName || null,
        transfer_email: transferEmail || null,
        max_price_each: input.maxPriceEach ?? null,
        member_id: memberId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updateError) {
      console.warn(
        JSON.stringify({ level: "warn", msg: "quick_buy_update_failed", error: updateError }),
      );
      return { ok: false, error: "Couldn't update your waitlist. Try again in a moment." };
    }
    if (!manualQueueOnly) {
      await allocateAvailableUnitsForEvent(input.eventSlug);
    }
    const offerId = manualQueueOnly
      ? undefined
      : ((await getLiveOfferIdForBuyLead(existing.id)) ?? undefined);
    return { ok: true, id: existing.id, contactId, offerId };
  }

  const { data, error } = await admin
    .from("beta_go_leads")
    .insert({
      intent: "buy",
      event_slug: input.eventSlug,
      quantity: input.quantity,
      contact_phone: phone || null,
      contact_instagram: ig || null,
      transfer_first_name: transferFirstName || null,
      transfer_last_name: transferLastName || null,
      transfer_email: transferEmail || null,
      max_price_each: input.maxPriceEach ?? null,
      acquisition_channel: leadSource(input),
      contact_id: contactId,
      member_id: memberId,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.warn(JSON.stringify({ level: "warn", msg: "quick_buy_insert_failed", error }));
    return { ok: false, error: "Couldn't join the waitlist. Try again in a moment." };
  }

  // Buyer ack only — ops is not emailed on waitlist join.
  void notifyBuyLead({
    kind: "waitlist_joined",
    buyLeadId: data.id,
    eventSlug: input.eventSlug,
  });

  // If inventory exists and this seat is next in the real queue, allocate now
  // so the buyer can jump straight to pay (skipped for fixed-price / manual).
  if (!manualQueueOnly) {
    await allocateAvailableUnitsForEvent(input.eventSlug);
  }
  const offerId = manualQueueOnly
    ? undefined
    : ((await getLiveOfferIdForBuyLead(data.id)) ?? undefined);

  return { ok: true, id: data.id, contactId, offerId };
}

export async function updateWaitlistLead(input: {
  leadId: string;
  contactId: string | null;
  allowedLeadIds: string[];
  quantity: number;
  contactPhone?: string;
  contactInstagram?: string;
  memberId?: string | null;
}): Promise<QuickLeadResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.leadId)) {
    return { ok: false, error: "Invalid waitlist entry." };
  }
  const qty = Math.min(QUICK_MAX_TICKETS, Math.max(1, Math.floor(input.quantity)));
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("beta_go_leads")
    .select("id, intent, status, contact_id, member_id")
    .eq("id", input.leadId)
    .maybeSingle();

  if (!row || row.intent !== "buy") {
    return { ok: false, error: "Waitlist entry not found." };
  }
  if (row.status === "cancelled" || row.status === "done") {
    return { ok: false, error: "That waitlist entry can’t be edited anymore." };
  }

  if (!ownsLead(row, input)) {
    return { ok: false, error: "You can only edit your own waitlist." };
  }

  const contactResult = await upsertGoContact({
    contactPhone: input.contactPhone,
    contactInstagram: input.contactInstagram,
    existingContactId: input.contactId ?? (row.contact_id as string | null),
    memberId: input.memberId,
  });
  if (!contactResult.ok) return { ok: false, error: contactResult.error };

  const phone =
    (input.contactPhone || "").trim() || contactResult.contact.contactPhone;
  const ig =
    (input.contactInstagram || "").trim() || contactResult.contact.contactInstagram;

  const { error } = await admin
    .from("beta_go_leads")
    .update({
      quantity: qty,
      contact_phone: phone || null,
      contact_instagram: ig || null,
      contact_id: contactResult.contact.id,
      member_id: contactResult.contact.memberId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.leadId);

  if (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "waitlist_update_failed", error }));
    return { ok: false, error: "Couldn't save those changes." };
  }
  return { ok: true, id: input.leadId, contactId: contactResult.contact.id };
}

export async function leaveWaitlistLead(input: {
  leadId: string;
  contactId: string | null;
  allowedLeadIds: string[];
  memberId?: string | null;
}): Promise<QuickLeadResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.leadId)) {
    return { ok: false, error: "Invalid waitlist entry." };
  }
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("beta_go_leads")
    .select("id, intent, status, contact_id, member_id")
    .eq("id", input.leadId)
    .maybeSingle();

  if (!row || row.intent !== "buy") {
    return { ok: false, error: "Waitlist entry not found." };
  }
  if (!ownsLead(row, input)) {
    return { ok: false, error: "You can only leave your own waitlist." };
  }

  const { error } = await admin
    .from("beta_go_leads")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", input.leadId);

  if (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "waitlist_leave_failed", error }));
    return { ok: false, error: "Couldn't leave the waitlist. Try again." };
  }
  return { ok: true, id: input.leadId, contactId: input.contactId ?? undefined };
}

/** Seller removes their /go listing — soft-cancel, same ownership as waitlist leave. */
export async function removeSellLead(input: {
  leadId: string;
  contactId: string | null;
  allowedLeadIds: string[];
  memberId?: string | null;
}): Promise<QuickLeadResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.leadId)) {
    return { ok: false, error: "Invalid listing." };
  }
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("beta_go_leads")
    .select("id, intent, status, contact_id, member_id")
    .eq("id", input.leadId)
    .maybeSingle();

  if (!row || row.intent !== "sell") {
    return { ok: false, error: "Listing not found." };
  }
  if (row.status === "cancelled") {
    return { ok: true, id: input.leadId, contactId: input.contactId ?? undefined };
  }

  if (!ownsLead(row, input)) {
    return { ok: false, error: "You can only remove your own listing." };
  }

  const { error } = await admin
    .from("beta_go_leads")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", input.leadId);

  if (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "sell_remove_failed", error }));
    return { ok: false, error: "Couldn't remove that listing. Try again." };
  }
  return { ok: true, id: input.leadId, contactId: input.contactId ?? undefined };
}

export async function submitQuickSell(
  input: QuickSellInput & { existingContactId?: string | null; memberId?: string | null },
  files?: { bytes: Uint8Array; name: string }[] | null,
): Promise<QuickLeadResult> {
  const listed = await getBetaEventBySlug(input.eventSlug);
  if (!listed?.supported) {
    return { ok: false, error: "Pick a supported event." };
  }

  const hasUrl = Boolean(input.ticketShareUrl);
  const uploads = (files ?? []).filter((f) => f.bytes.byteLength > 0);
  const hasFiles = uploads.length > 0;
  if (!hasUrl && !hasFiles) {
    return { ok: false, error: "Upload a ticket screenshot or paste a share link." };
  }
  if (!hasUrl && uploads.length < input.quantity) {
    return {
      ok: false,
      error:
        input.quantity === 1
          ? "Upload a ticket screenshot or paste a share link."
          : `Upload all ${input.quantity} ticket files, or paste one share link.`,
    };
  }

  const evidencePaths: string[] = [];
  if (hasFiles) {
    const admin = createAdminClient();
    const folder = crypto.randomUUID();
    for (let i = 0; i < uploads.length; i++) {
      const file = uploads[i]!;
      const validation = validateTicketEvidenceFile(file.bytes);
      if (!validation.ok) return { ok: false, error: validation.message };

      const path = `${folder}/${i}-${Date.now()}.${validation.ext}`;
      const { error: uploadError } = await admin.storage
        .from("beta-quick-tickets")
        .upload(path, file.bytes, { contentType: validation.mime, upsert: false });
      if (uploadError) {
        return { ok: false, error: "Ticket upload failed. Try again or paste a share link." };
      }
      evidencePaths.push(path);
    }
  }

  const evidencePath = encodeEvidencePaths(evidencePaths);

  const contactResult = await upsertGoContact({
    contactPhone: input.contactPhone,
    contactInstagram: input.contactInstagram,
    etransferName: input.etransferName,
    etransferEmail: input.etransferEmail,
    etransferPhone: input.etransferPhone,
    existingContactId: input.existingContactId,
    memberId: input.memberId,
  });
  if (!contactResult.ok) {
    return { ok: false, error: contactResult.error };
  }
  const contactId = contactResult.contact.id;
  const memberId = contactResult.contact.memberId;

  const phone = (input.contactPhone || "").trim() || contactResult.contact.contactPhone;
  const ig = (input.contactInstagram || "").trim() || contactResult.contact.contactInstagram;
  if (!phone && !ig) {
    return { ok: false, error: "Add a WhatsApp number or Instagram so we can reach you." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_go_leads")
    .insert({
      intent: "sell",
      event_slug: input.eventSlug,
      quantity: input.quantity,
      contact_phone: phone || null,
      contact_instagram: ig || null,
      paid_each: input.paidEach,
      ask_each: input.askEach,
      ticket_share_url: input.ticketShareUrl || null,
      ticket_evidence_path: evidencePath,
      etransfer_name: input.etransferName,
      etransfer_email: input.etransferEmail || null,
      etransfer_phone: input.etransferPhone || null,
      seller_terms_accepted_at: new Date().toISOString(),
      acquisition_channel: leadSource(input),
      contact_id: contactId,
      member_id: memberId,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.warn(JSON.stringify({ level: "warn", msg: "quick_sell_insert_failed", error }));
    const hint =
      error?.code === "23514"
        ? "Check contact, Interac, and ticket proof fields."
        : "Couldn't submit. Try again in a moment.";
    return { ok: false, error: hint };
  }

  // Split the sell lead into exclusive ticket units (0021). Failure here must
  // not roll back the lead — ops can recreate units — but log loudly.
  const units = await createUnitsFromSellLead(data.id);
  if (!units.ok) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "sell_units_create_failed",
        lead_id: data.id,
        error: units.error,
      }),
    );
  } else {
    // New inventory → try exclusive offers for anyone already waiting.
    void allocateAvailableUnitsForEvent(input.eventSlug).catch(() => {});
  }

  void notifyAdminsOfQuickLead({
    id: data.id,
    intent: "sell",
    eventSlug: input.eventSlug,
    quantity: input.quantity,
    contactPhone: phone ?? undefined,
    contactInstagram: ig ?? undefined,
    paidEach: input.paidEach,
    askEach: input.askEach,
    ticketShareUrl: input.ticketShareUrl ?? undefined,
    hasEvidence: evidencePaths.length > 0,
    etransferName: input.etransferName,
    etransferEmail: input.etransferEmail ?? undefined,
    etransferPhone: input.etransferPhone ?? undefined,
  }).catch(() => {});

  void notifySellLead({
    kind: "seller_listed",
    sellLeadId: data.id,
    priceEach: input.askEach,
    eventSlug: input.eventSlug,
    quantity: input.quantity,
  });

  return { ok: true, id: data.id, contactId };
}

/** Queue cards for the /go hub — positions in the shared classic+/go queue. */
export async function getQuickWaitlistEntries(
  leadIds: string[],
): Promise<QuickWaitlistEntry[]> {
  const ids = [...new Set(leadIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 20);
  if (ids.length === 0) return [];

  const admin = createAdminClient();
  const [{ data: mine, error }, fakeFronts] = await Promise.all([
    admin
      .from("beta_go_leads")
      .select("id, event_slug, quantity, status, created_at, contact_phone, contact_instagram")
      .eq("intent", "buy")
      .in("id", ids)
      .order("created_at", { ascending: true }),
    getFakeFrontMap(),
  ]);

  if (error || !mine?.length) return [];

  const seatsByEvent = new Map<string, Awaited<ReturnType<typeof listUnifiedQueueSeats>>>();
  const entries: QuickWaitlistEntry[] = [];
  const seatKeys = mine.map((row) => `go:${row.id}`);

  const [{ data: seatStates }, { data: liveOffers }] = await Promise.all([
    admin
      .from("beta_queue_seat_state")
      .select("seat_key, dormant_at")
      .in("seat_key", seatKeys),
    admin
      .from("beta_offers")
      .select("id, buy_lead_id, status")
      .in("buy_lead_id", ids)
      .in("status", ["offered", "accepted"]),
  ]);

  const dormantBySeat = new Map(
    (seatStates ?? []).map((s) => [s.seat_key as string, Boolean(s.dormant_at)]),
  );
  const offerByLead = new Map(
    (liveOffers ?? []).map((o) => [o.buy_lead_id as string, o.id as string]),
  );

  const catalog = await loadBetaCatalog();
  const bySlug = new Map(catalog.map((e) => [e.slug, e]));

  for (const row of mine) {
    if (row.status === "cancelled") continue;
    let seats = seatsByEvent.get(row.event_slug);
    if (!seats) {
      seats = await listUnifiedQueueSeats(row.event_slug);
      seatsByEvent.set(row.event_slug, seats);
    }
    const fakeFront = fakeFronts.get(row.event_slug) ?? 0;
    const pos = positionInSeats(seats, (s) => s.source === "go" && s.id === row.id, fakeFront);
    const event = bySlug.get(row.event_slug) ?? betaEventBySlug(row.event_slug);
    const seatKey = `go:${row.id}`;
    entries.push({
      leadId: row.id,
      eventSlug: row.event_slug,
      eventName: event?.name ?? row.event_slug,
      quantity: Math.min(QUICK_MAX_TICKETS, Math.max(1, Number(row.quantity) || 1)),
      position: pos?.displayed ?? 1 + fakeFront,
      status: row.status,
      createdAt: row.created_at,
      contactPhone: (row.contact_phone as string | null) ?? null,
      contactInstagram: (row.contact_instagram as string | null) ?? null,
      dormant: dormantBySeat.get(seatKey) ?? false,
      activeOfferId: offerByLead.get(row.id) ?? null,
    });
  }

  return entries;
}

/**
 * All non-cancelled /go leads for this person — buy + sell history with
 * pricing. Matched on the device's contact cookie *or* their beta member id,
 * so a member who clears cookies or opens the app on a second device still
 * sees the tickets they listed and the waitlists they joined.
 */
export async function getGoActivity(input: {
  contactId?: string | null;
  memberId?: string | null;
}): Promise<GoActivityEntry[]> {
  const contactId = isUuid(input.contactId) ? input.contactId! : null;
  const memberId = isUuid(input.memberId) ? input.memberId! : null;
  if (!contactId && !memberId) return [];

  const admin = createAdminClient();
  let query = admin
    .from("beta_go_leads")
    .select(
      "id, intent, event_slug, quantity, status, paid_each, ask_each, created_at, seller_ticket_sent_at, ticket_received_at",
    );

  // `.or()` takes PostgREST filter syntax, not a chained builder — each term is
  // `column.op.value`, comma-separated.
  query =
    contactId && memberId
      ? query.or(`contact_id.eq.${contactId},member_id.eq.${memberId}`)
      : contactId
        ? query.eq("contact_id", contactId)
        : query.eq("member_id", memberId!);

  const { data, error } = await query
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !data?.length) return [];

  const sellIds = data.filter((r) => r.intent === "sell").map((r) => r.id as string);
  const saleStageByLead = new Map<string, "awaiting_transfer" | "payout_released">();
  if (sellIds.length > 0) {
    const { data: units } = await admin
      .from("beta_ticket_units")
      .select("id, sell_lead_id")
      .in("sell_lead_id", sellIds);
    const unitIds = (units ?? []).map((u) => u.id as string);
    const sellByUnit = new Map(
      (units ?? []).map((u) => [u.id as string, u.sell_lead_id as string]),
    );
    if (unitIds.length > 0) {
      const { data: offers } = await admin
        .from("beta_offers")
        .select("unit_id, status, payout_released_at")
        .in("unit_id", unitIds)
        .eq("status", "paid");
      for (const o of offers ?? []) {
        const leadId = sellByUnit.get(o.unit_id as string);
        if (!leadId) continue;
        const stage = o.payout_released_at ? "payout_released" : "awaiting_transfer";
        // Prefer awaiting_transfer if any unit still needs transfer.
        const prev = saleStageByLead.get(leadId);
        if (prev === "awaiting_transfer") continue;
        saleStageByLead.set(leadId, stage);
      }
    }
  }

  const catalog = await loadBetaCatalog();
  const bySlug = new Map(catalog.map((e) => [e.slug, e]));

  return data.map((row) => {
    const qty = Number(row.quantity) || 1;
    const paid = row.paid_each != null ? Number(row.paid_each) : null;
    const ask = row.ask_each != null ? Number(row.ask_each) : null;
    const done = row.status === "done";
    const proceedsCad =
      row.intent === "sell" && done && ask != null ? ask * qty : null;
    const netVsPaidCad =
      proceedsCad != null && paid != null ? proceedsCad - paid * qty : null;
    const event = bySlug.get(row.event_slug) ?? betaEventBySlug(row.event_slug);
    return {
      leadId: row.id,
      intent: row.intent as "buy" | "sell",
      eventSlug: row.event_slug,
      eventName: event?.name ?? row.event_slug,
      quantity: qty,
      status: row.status,
      paidEach: paid,
      askEach: ask,
      proceedsCad,
      netVsPaidCad,
      createdAt: row.created_at,
      saleStage: saleStageByLead.get(row.id) ?? null,
      sellerTicketSentAt: (row.seller_ticket_sent_at as string | null) ?? null,
      ticketReceivedAt: (row.ticket_received_at as string | null) ?? null,
    };
  });
}

function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
}

export type LeadIdentityHints = {
  name: string | null;
  email: string | null;
  phone: string | null;
  eventName: string | null;
  intent: "buy" | "sell" | null;
};

/**
 * Whatever the most recent lead can tell us about who this person is, for
 * prefilling the save-profile card.
 *
 * Only some of it exists for any given lead: the transfer name/email are
 * collected on the Café Campus buy step (one of four events), and the Interac
 * fields only on a sell. A Piknik buyer reaches the success screen having
 * given nothing but a phone number, so the card still has to ask.
 */
export async function getLeadIdentityHints(input: {
  contactId?: string | null;
  memberId?: string | null;
}): Promise<LeadIdentityHints | null> {
  const contactId = isUuid(input.contactId) ? input.contactId! : null;
  const memberId = isUuid(input.memberId) ? input.memberId! : null;
  if (!contactId && !memberId) return null;

  const admin = createAdminClient();
  let query = admin
    .from("beta_go_leads")
    .select(
      "intent, event_slug, contact_phone, transfer_first_name, transfer_last_name, transfer_email, etransfer_name, etransfer_email, created_at",
    );
  query =
    contactId && memberId
      ? query.or(`contact_id.eq.${contactId},member_id.eq.${memberId}`)
      : contactId
        ? query.eq("contact_id", contactId)
        : query.eq("member_id", memberId!);

  const { data } = await query
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const transferName = [data.transfer_first_name, data.transfer_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    name: transferName || (data.etransfer_name as string | null) || null,
    email:
      (data.transfer_email as string | null) || (data.etransfer_email as string | null) || null,
    phone: (data.contact_phone as string | null) ?? null,
    eventName: betaEventBySlug(data.event_slug)?.name ?? data.event_slug ?? null,
    intent: (data.intent as "buy" | "sell" | null) ?? null,
  };
}

/**
 * Buy lead ids for this person — used to hydrate the waitlist cards when the
 * device cookie is thin or missing. Same contact-or-member matching as
 * `getGoActivity`, for the same reason.
 */
export async function listBuyLeadIds(input: {
  contactId?: string | null;
  memberId?: string | null;
}): Promise<string[]> {
  const contactId = isUuid(input.contactId) ? input.contactId! : null;
  const memberId = isUuid(input.memberId) ? input.memberId! : null;
  if (!contactId && !memberId) return [];

  const admin = createAdminClient();
  let query = admin.from("beta_go_leads").select("id");
  query =
    contactId && memberId
      ? query.or(`contact_id.eq.${contactId},member_id.eq.${memberId}`)
      : contactId
        ? query.eq("contact_id", contactId)
        : query.eq("member_id", memberId!);

  const { data } = await query
    .eq("intent", "buy")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => r.id as string);
}

export async function submitQuickEventRequest(input: {
  name: string;
  details?: string | null;
  memberId?: string | null;
  email?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("beta_member_event_requests").insert({
    name: input.name,
    details: input.details ?? null,
    member_id: input.memberId ?? null,
  });
  if (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "quick_event_request_failed", error }));
    return { ok: false, error: "Couldn't send request. Please try again." };
  }

  const { sendEventRequestConfirmation } = await import("@/domains/beta-signup/service");
  void sendEventRequestConfirmation({
    memberId: input.memberId ?? null,
    email: input.email ?? null,
    requestedName: input.name,
    details: input.details ?? null,
  }).catch(() => {});

  return { ok: true };
}

