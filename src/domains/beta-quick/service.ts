import "server-only";

import { z } from "zod";
import { notifyAdminsOfQuickLead } from "@/domains/admin-alerts/service";
import { upsertGoContact } from "@/domains/beta-go/contacts";
import {
  getFakeFrontMap,
  listUnifiedQueueSeats,
  positionInSeats,
} from "@/domains/beta-queue/unified";
import { ACQUISITION_CHANNELS } from "@/lib/beta-acquisition";
import { betaEventBySlug } from "@/lib/beta-events";
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
    /** Café Campus ticket-transfer recipient — required only for that event. */
    transferFirstName: z.string().trim().max(80).optional().default(""),
    transferLastName: z.string().trim().max(80).optional().default(""),
    transferEmail: z
      .string()
      .trim()
      .max(320)
      .optional()
      .default("")
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email."),
    acquisitionChannel: z.enum(ACQUISITION_CHANNELS).optional(),
  })
  .superRefine(contactRefine)
  .superRefine((value, ctx) => {
    if (!betaEventBySlug(value.eventSlug)?.supported) {
      ctx.addIssue({ code: "custom", message: "Pick a supported event.", path: ["eventSlug"] });
    }
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
  })
  .superRefine(contactRefine)
  .superRefine((value, ctx) => {
    if (!betaEventBySlug(value.eventSlug)?.supported) {
      ctx.addIssue({ code: "custom", message: "Pick a supported event.", path: ["eventSlug"] });
    }
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

export type QuickBuyInput = z.infer<typeof quickBuySchema>;
export type QuickSellInput = z.infer<typeof quickSellSchema>;

export type QuickLeadResult =
  | { ok: true; id: string; contactId?: string }
  | { ok: false; error: string };

export async function submitQuickBuy(
  input: QuickBuyInput & { existingContactId?: string | null },
): Promise<QuickLeadResult> {
  const contactResult = await upsertGoContact({
    contactPhone: input.contactPhone,
    contactInstagram: input.contactInstagram,
    existingContactId: input.existingContactId,
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

  const transferFirstName =
    input.eventSlug === "cafe-campus" ? input.transferFirstName.trim() : "";
  const transferLastName =
    input.eventSlug === "cafe-campus" ? input.transferLastName.trim() : "";
  const transferEmail =
    input.eventSlug === "cafe-campus" ? input.transferEmail.trim().toLowerCase() : "";

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
    return { ok: true, id: existing.id, contactId };
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
      acquisition_channel: input.acquisitionChannel ?? null,
      contact_id: contactId,
      member_id: memberId,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.warn(JSON.stringify({ level: "warn", msg: "quick_buy_insert_failed", error }));
    return { ok: false, error: "Couldn't join the waitlist. Try again in a moment." };
  }

  void notifyAdminsOfQuickLead({
    id: data.id,
    intent: "buy",
    eventSlug: input.eventSlug,
    quantity: input.quantity,
    contactPhone: phone ?? undefined,
    contactInstagram: ig ?? undefined,
    transferFirstName: transferFirstName || undefined,
    transferLastName: transferLastName || undefined,
    transferEmail: transferEmail || undefined,
  }).catch(() => {});

  return { ok: true, id: data.id, contactId };
}

export async function updateWaitlistLead(input: {
  leadId: string;
  contactId: string | null;
  allowedLeadIds: string[];
  quantity: number;
  contactPhone?: string;
  contactInstagram?: string;
}): Promise<QuickLeadResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.leadId)) {
    return { ok: false, error: "Invalid waitlist entry." };
  }
  const qty = Math.min(QUICK_MAX_TICKETS, Math.max(1, Math.floor(input.quantity)));
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("beta_go_leads")
    .select("id, intent, status, contact_id")
    .eq("id", input.leadId)
    .maybeSingle();

  if (!row || row.intent !== "buy") {
    return { ok: false, error: "Waitlist entry not found." };
  }
  if (row.status === "cancelled" || row.status === "done") {
    return { ok: false, error: "That waitlist entry can’t be edited anymore." };
  }

  const ownsByContact = Boolean(input.contactId && row.contact_id === input.contactId);
  const ownsByCookie = input.allowedLeadIds.includes(row.id);
  if (!ownsByContact && !ownsByCookie) {
    return { ok: false, error: "You can only edit your own waitlist." };
  }

  const contactResult = await upsertGoContact({
    contactPhone: input.contactPhone,
    contactInstagram: input.contactInstagram,
    existingContactId: input.contactId ?? (row.contact_id as string | null),
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
}): Promise<QuickLeadResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.leadId)) {
    return { ok: false, error: "Invalid waitlist entry." };
  }
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("beta_go_leads")
    .select("id, intent, status, contact_id")
    .eq("id", input.leadId)
    .maybeSingle();

  if (!row || row.intent !== "buy") {
    return { ok: false, error: "Waitlist entry not found." };
  }
  const ownsByContact = Boolean(input.contactId && row.contact_id === input.contactId);
  const ownsByCookie = input.allowedLeadIds.includes(row.id);
  if (!ownsByContact && !ownsByCookie) {
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
}): Promise<QuickLeadResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.leadId)) {
    return { ok: false, error: "Invalid listing." };
  }
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("beta_go_leads")
    .select("id, intent, status, contact_id")
    .eq("id", input.leadId)
    .maybeSingle();

  if (!row || row.intent !== "sell") {
    return { ok: false, error: "Listing not found." };
  }
  if (row.status === "cancelled") {
    return { ok: true, id: input.leadId, contactId: input.contactId ?? undefined };
  }

  const ownsByContact = Boolean(input.contactId && row.contact_id === input.contactId);
  const ownsByCookie = input.allowedLeadIds.includes(row.id);
  if (!ownsByContact && !ownsByCookie) {
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
  input: QuickSellInput & { existingContactId?: string | null },
  files?: { bytes: Uint8Array; name: string }[] | null,
): Promise<QuickLeadResult> {
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
      acquisition_channel: input.acquisitionChannel ?? null,
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

  for (const row of mine) {
    if (row.status === "cancelled") continue;
    let seats = seatsByEvent.get(row.event_slug);
    if (!seats) {
      seats = await listUnifiedQueueSeats(row.event_slug);
      seatsByEvent.set(row.event_slug, seats);
    }
    const fakeFront = fakeFronts.get(row.event_slug) ?? 0;
    const pos = positionInSeats(seats, (s) => s.source === "go" && s.id === row.id, fakeFront);
    const event = betaEventBySlug(row.event_slug);
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
    });
  }

  return entries;
}

/**
 * All non-cancelled /go leads for a contact — buy + sell history with pricing.
 * Powered by the `passe_go_contact` cookie; no beta member signup required.
 */
export async function getGoContactActivity(contactId: string): Promise<GoActivityEntry[]> {
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_go_leads")
    .select(
      "id, intent, event_slug, quantity, status, paid_each, ask_each, created_at",
    )
    .eq("contact_id", contactId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !data?.length) return [];

  return data.map((row) => {
    const qty = Number(row.quantity) || 1;
    const paid = row.paid_each != null ? Number(row.paid_each) : null;
    const ask = row.ask_each != null ? Number(row.ask_each) : null;
    const done = row.status === "done";
    const proceedsCad =
      row.intent === "sell" && done && ask != null ? ask * qty : null;
    const netVsPaidCad =
      proceedsCad != null && paid != null ? proceedsCad - paid * qty : null;
    const event = betaEventBySlug(row.event_slug);
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
    };
  });
}

/** Buy lead ids for a contact — used to hydrate waitlist when the device cookie is thin. */
export async function listBuyLeadIdsForContact(contactId: string): Promise<string[]> {
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("beta_go_leads")
    .select("id")
    .eq("contact_id", contactId)
    .eq("intent", "buy")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => r.id as string);
}
