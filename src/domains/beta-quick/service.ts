import "server-only";

import { z } from "zod";
import { notifyAdminsOfQuickLead } from "@/domains/admin-alerts/service";
import {
  getFakeFrontMap,
  listUnifiedQueueSeats,
  positionInSeats,
} from "@/domains/beta-queue/unified";
import { ACQUISITION_CHANNELS } from "@/lib/beta-acquisition";
import { betaEventBySlug } from "@/lib/beta-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTicketEvidenceFile } from "@/lib/verification/ticket-evidence";
import type { QuickWaitlistEntry } from "./shared";

export type { QuickWaitlistEntry } from "./shared";

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
    quantity: z.coerce.number().int().min(1).max(20),
    contactPhone: z.string().trim().max(30).optional().default(""),
    contactInstagram: z
      .string()
      .trim()
      .max(40)
      .transform((v) => v.replace(/^@+/, "").replace(/\s+/g, ""))
      .optional()
      .default(""),
    acquisitionChannel: z.enum(ACQUISITION_CHANNELS).optional(),
  })
  .superRefine(contactRefine)
  .superRefine((value, ctx) => {
    if (!betaEventBySlug(value.eventSlug)?.supported) {
      ctx.addIssue({ code: "custom", message: "Pick a supported event.", path: ["eventSlug"] });
    }
  });

export const quickSellSchema = z
  .object({
    eventSlug: z.string().trim().min(1).max(80),
    quantity: z.coerce.number().int().min(1).max(20),
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
    // Face-value style cap for beta facilitation: never ask above what they paid.
    if (value.askEach > value.paidEach) {
      ctx.addIssue({
        code: "custom",
        message: "Ask price can't be higher than what you paid.",
        path: ["askEach"],
      });
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
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function submitQuickBuy(input: QuickBuyInput): Promise<QuickLeadResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_quick_leads")
    .insert({
      intent: "buy",
      event_slug: input.eventSlug,
      quantity: input.quantity,
      contact_phone: input.contactPhone || null,
      contact_instagram: input.contactInstagram || null,
      acquisition_channel: input.acquisitionChannel ?? null,
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
    contactPhone: input.contactPhone,
    contactInstagram: input.contactInstagram,
  }).catch(() => {});

  return { ok: true, id: data.id };
}

export async function submitQuickSell(
  input: QuickSellInput,
  file?: { bytes: Uint8Array; name: string } | null,
): Promise<QuickLeadResult> {
  const hasUrl = Boolean(input.ticketShareUrl);
  const hasFile = Boolean(file && file.bytes.byteLength > 0);
  if (!hasUrl && !hasFile) {
    return { ok: false, error: "Upload a ticket screenshot or paste a share link." };
  }

  let evidencePath: string | null = null;
  if (hasFile && file) {
    const validation = validateTicketEvidenceFile(file.bytes);
    if (!validation.ok) return { ok: false, error: validation.message };

    const admin = createAdminClient();
    const path = `${crypto.randomUUID()}/${Date.now()}.${validation.ext}`;
    const { error: uploadError } = await admin.storage
      .from("beta-quick-tickets")
      .upload(path, file.bytes, { contentType: validation.mime, upsert: false });
    if (uploadError) {
      return { ok: false, error: "Ticket upload failed. Try again or paste a share link." };
    }
    evidencePath = path;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_quick_leads")
    .insert({
      intent: "sell",
      event_slug: input.eventSlug,
      quantity: input.quantity,
      contact_phone: input.contactPhone || null,
      contact_instagram: input.contactInstagram || null,
      paid_each: input.paidEach,
      ask_each: input.askEach,
      ticket_share_url: input.ticketShareUrl || null,
      ticket_evidence_path: evidencePath,
      etransfer_name: input.etransferName,
      etransfer_email: input.etransferEmail || null,
      etransfer_phone: input.etransferPhone || null,
      seller_terms_accepted_at: new Date().toISOString(),
      acquisition_channel: input.acquisitionChannel ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.warn(JSON.stringify({ level: "warn", msg: "quick_sell_insert_failed", error }));
    return { ok: false, error: "Couldn't submit. Try again in a moment." };
  }

  void notifyAdminsOfQuickLead({
    id: data.id,
    intent: "sell",
    eventSlug: input.eventSlug,
    quantity: input.quantity,
    contactPhone: input.contactPhone,
    contactInstagram: input.contactInstagram,
    paidEach: input.paidEach,
    askEach: input.askEach,
    ticketShareUrl: input.ticketShareUrl,
    hasEvidence: Boolean(evidencePath),
    etransferName: input.etransferName,
    etransferEmail: input.etransferEmail,
    etransferPhone: input.etransferPhone,
  }).catch(() => {});

  return { ok: true, id: data.id };
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
      .from("beta_quick_leads")
      .select("id, event_slug, quantity, status, created_at")
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
      quantity: row.quantity,
      position: pos?.displayed ?? 1 + fakeFront,
      status: row.status,
      createdAt: row.created_at,
    });
  }

  return entries;
}
