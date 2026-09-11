import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { betaEventBySlug } from "@/lib/beta-events";
import { requireBetaOpsSession } from "./auth";
export const LEAD_STATUSES = ["new", "contacted", "matched", "done", "cancelled"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type QuickLeadRow = {
  id: string;
  intent: "buy" | "sell";
  eventSlug: string;
  eventName: string;
  quantity: number;
  contactPhone: string | null;
  contactInstagram: string | null;
  paidEach: number | null;
  askEach: number | null;
  ticketShareUrl: string | null;
  ticketEvidencePath: string | null;
  etransferName: string | null;
  etransferEmail: string | null;
  etransferPhone: string | null;
  status: LeadStatus;
  adminNotes: string | null;
  acquisitionChannel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpsStats = {
  buyNew: number;
  sellNew: number;
  buyOpen: number;
  sellOpen: number;
  done: number;
};

function mapLead(row: Record<string, unknown>): QuickLeadRow {
  const slug = String(row.event_slug);
  return {
    id: String(row.id),
    intent: row.intent as "buy" | "sell",
    eventSlug: slug,
    eventName: betaEventBySlug(slug)?.name ?? slug,
    quantity: Number(row.quantity),
    contactPhone: (row.contact_phone as string | null) ?? null,
    contactInstagram: (row.contact_instagram as string | null) ?? null,
    paidEach: row.paid_each != null ? Number(row.paid_each) : null,
    askEach: row.ask_each != null ? Number(row.ask_each) : null,
    ticketShareUrl: (row.ticket_share_url as string | null) ?? null,
    ticketEvidencePath: (row.ticket_evidence_path as string | null) ?? null,
    etransferName: (row.etransfer_name as string | null) ?? null,
    etransferEmail: (row.etransfer_email as string | null) ?? null,
    etransferPhone: (row.etransfer_phone as string | null) ?? null,
    status: (row.status as LeadStatus) ?? "new",
    adminNotes: (row.admin_notes as string | null) ?? null,
    acquisitionChannel: (row.acquisition_channel as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export async function listQuickLeads(filter?: {
  intent?: "buy" | "sell";
  status?: LeadStatus | "open";
}): Promise<QuickLeadRow[]> {
  const admin = createAdminClient();
  let q = admin
    .from("beta_quick_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter?.intent) q = q.eq("intent", filter.intent);
  if (filter?.status === "open") {
    q = q.in("status", ["new", "contacted", "matched"]);
  } else if (filter?.status) {
    q = q.eq("status", filter.status);
  }

  const { data, error } = await q;
  if (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "ops_list_leads_failed", error }));
    return [];
  }
  return (data ?? []).map((row) => mapLead(row as Record<string, unknown>));
}

export async function getOpsStats(): Promise<OpsStats> {
  const admin = createAdminClient();
  const { data } = await admin.from("beta_quick_leads").select("intent, status");
  const rows = data ?? [];
  const open = new Set(["new", "contacted", "matched"]);
  return {
    buyNew: rows.filter((r) => r.intent === "buy" && r.status === "new").length,
    sellNew: rows.filter((r) => r.intent === "sell" && r.status === "new").length,
    buyOpen: rows.filter((r) => r.intent === "buy" && open.has(r.status)).length,
    sellOpen: rows.filter((r) => r.intent === "sell" && open.has(r.status)).length,
    done: rows.filter((r) => r.status === "done").length,
  };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(LEAD_STATUSES).optional(),
  adminNotes: z.string().trim().max(2000).optional(),
});

export async function updateQuickLead(
  input: z.infer<typeof updateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireBetaOpsSession();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid update." };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status) patch.status = parsed.data.status;
  if (parsed.data.adminNotes !== undefined) patch.admin_notes = parsed.data.adminNotes || null;

  const admin = createAdminClient();
  const { error } = await admin.from("beta_quick_leads").update(patch).eq("id", parsed.data.id);
  if (error) return { ok: false, error: "Couldn't save that." };
  return { ok: true };
}

/** Signed URL for a private ticket screenshot (1 hour). */
export async function getTicketEvidenceSignedUrl(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("beta-quick-tickets")
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
