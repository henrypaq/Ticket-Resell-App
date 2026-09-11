import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { betaEventBySlug, INTEREST_OPTIONS } from "@/lib/beta-events";
import { defaultFakeFront, getFakeFrontMap } from "@/domains/beta-queue/padding";
import { requireBetaOpsSession } from "./auth";
import {
  LEAD_STATUSES,
  type LeadStatus,
  type QuickLeadRow,
  type ClassicMemberRow,
  type ClassicInterest,
  type QueuePaddingRow,
  type OpsWaitlistEntry,
} from "./shared";

export {
  LEAD_STATUSES,
  type LeadStatus,
  type QuickLeadRow,
  type ClassicMemberRow,
  type ClassicInterest,
  type QueuePaddingRow,
  type OpsWaitlistEntry,
} from "./shared";

export type OpsStats = {
  buyNew: number;
  sellNew: number;
  buyOpen: number;
  sellOpen: number;
  done: number;
  classicMembers: number;
  bySource: { channel: string; count: number }[];
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
  const [{ data }, { data: signups }] = await Promise.all([
    admin.from("beta_quick_leads").select("intent, status"),
    admin.from("beta_signups").select("acquisition_channel"),
  ]);
  const rows = data ?? [];
  const open = new Set(["new", "contacted", "matched"]);
  const sourceMap = new Map<string, number>();
  for (const s of signups ?? []) {
    const key = s.acquisition_channel ?? "(none)";
    sourceMap.set(key, (sourceMap.get(key) ?? 0) + 1);
  }
  return {
    buyNew: rows.filter((r) => r.intent === "buy" && r.status === "new").length,
    sellNew: rows.filter((r) => r.intent === "sell" && r.status === "new").length,
    buyOpen: rows.filter((r) => r.intent === "buy" && open.has(r.status)).length,
    sellOpen: rows.filter((r) => r.intent === "sell" && open.has(r.status)).length,
    done: rows.filter((r) => r.status === "done").length,
    classicMembers: (signups ?? []).length,
    bySource: [...sourceMap.entries()]
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function listClassicMembers(): Promise<ClassicMemberRow[]> {
  const admin = createAdminClient();
  const { data: signups, error } = await admin
    .from("beta_signups")
    .select(
      "id, name, email, phone, intent, interested_events, priority, school, referral_source, acquisition_channel, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (error || !signups?.length) {
    if (error) {
      console.warn(JSON.stringify({ level: "warn", msg: "ops_list_members_failed", error }));
    }
    return [];
  }

  const ids = signups.map((s) => s.id);
  const { data: interests } = await admin
    .from("beta_event_interests")
    .select("signup_id, event_slug, intent, contact_phone, contact_instagram")
    .in("signup_id", ids);

  const bySignup = new Map<string, ClassicInterest[]>();
  for (const row of interests ?? []) {
    const list = bySignup.get(row.signup_id) ?? [];
    list.push({
      eventSlug: row.event_slug,
      eventName: betaEventBySlug(row.event_slug)?.name ?? row.event_slug,
      intent: row.intent as "waitlist" | "sell",
      contactPhone: row.contact_phone ?? null,
      contactInstagram: row.contact_instagram ?? null,
    });
    bySignup.set(row.signup_id, list);
  }

  return signups.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone ?? "",
    intent: s.intent as "buy" | "sell" | "both",
    interestedEvents: (s.interested_events as string[]) ?? [],
    priority: s.priority,
    school: s.school,
    referralSource: s.referral_source,
    acquisitionChannel: s.acquisition_channel,
    createdAt: s.created_at,
    interests: bySignup.get(s.id) ?? [],
  }));
}

const addMemberSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  email: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .max(320)
    .transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(30).optional().default(""),
  intent: z.enum(["buy", "sell", "both"]),
  acquisitionChannel: z.enum([
    "qr_share",
    "qr_print",
    "ig_bio",
    "manual",
    "friend",
    "campus",
    "other",
  ]),
  referralSource: z.string().trim().max(160).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export async function addClassicMember(
  input: z.infer<typeof addMemberSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireBetaOpsSession();
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid member." };
  }

  const admin = createAdminClient();
  const referral =
    [parsed.data.referralSource, parsed.data.notes ? `note: ${parsed.data.notes}` : ""]
      .filter(Boolean)
      .join(" · ") || null;

  const { data, error } = await admin
    .from("beta_signups")
    .insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || "",
      intent: parsed.data.intent,
      interested_events: [],
      priority: "both",
      school: null,
      referral_source: referral,
      notify_opt_in: false,
      acquisition_channel: parsed.data.acquisitionChannel,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That email is already on the list." };
    }
    console.warn(JSON.stringify({ level: "warn", msg: "ops_add_member_failed", error }));
    return { ok: false, error: "Couldn't add that member." };
  }

  return { ok: true, id: data.id };
}

function eventDaysForSlug(slug: string): string[] {
  return betaEventBySlug(slug)?.days ?? [];
}

/** Classic waitlist interests + /go buy leads, newest first, with displayed #. */
export async function listOpsWaitlistEntries(): Promise<OpsWaitlistEntry[]> {
  const admin = createAdminClient();
  const fakeFronts = await getFakeFrontMap();

  const [{ data: interests }, goLeads] = await Promise.all([
    admin
      .from("beta_event_interests")
      .select(
        "id, signup_id, event_slug, intent, created_at, contact_phone, contact_instagram, beta_signups(name, email, phone, acquisition_channel)",
      )
      .eq("intent", "waitlist")
      .order("created_at", { ascending: false })
      .limit(300),
    listQuickLeads({ intent: "buy" }),
  ]);

  // Real ranks within each classic event queue (oldest first).
  const classicRank = new Map<string, number>();
  const { data: ordered } = await admin
    .from("beta_event_interests")
    .select("id, event_slug")
    .eq("intent", "waitlist")
    .order("created_at", { ascending: true });
  const counters = new Map<string, number>();
  for (const row of ordered ?? []) {
    const n = (counters.get(row.event_slug) ?? 0) + 1;
    counters.set(row.event_slug, n);
    classicRank.set(row.id, n);
  }

  const classicEntries: OpsWaitlistEntry[] = (interests ?? []).map((row) => {
    const signup = row.beta_signups as
      | { name: string; email: string; phone: string | null; acquisition_channel: string | null }
      | null
      | { name: string; email: string; phone: string | null; acquisition_channel: string | null }[];
    const person = Array.isArray(signup) ? signup[0] : signup;
    const real = classicRank.get(row.id) ?? 1;
    const fake = fakeFronts.get(row.event_slug) ?? defaultFakeFront(row.event_slug);
    return {
      id: row.id,
      source: "classic" as const,
      name: person?.name ?? null,
      email: person?.email ?? null,
      eventSlug: row.event_slug,
      eventName: betaEventBySlug(row.event_slug)?.name ?? row.event_slug,
      eventDays: eventDaysForSlug(row.event_slug),
      quantity: 1,
      displayedPosition: real + fake,
      contactPhone: row.contact_phone || person?.phone || null,
      contactInstagram: row.contact_instagram ?? null,
      status: "classic" as const,
      acquisitionChannel: person?.acquisition_channel ?? null,
      adminNotes: null,
      createdAt: row.created_at,
    };
  });

  // Real ranks among /go buy leads per event.
  const goRank = new Map<string, number>();
  const goByEvent = new Map<string, QuickLeadRow[]>();
  for (const lead of goLeads) {
    if (lead.status === "cancelled") continue;
    const list = goByEvent.get(lead.eventSlug) ?? [];
    list.push(lead);
    goByEvent.set(lead.eventSlug, list);
  }
  for (const [, list] of goByEvent) {
    list
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((lead, i) => goRank.set(lead.id, i + 1));
  }

  const goEntries: OpsWaitlistEntry[] = goLeads.map((lead) => {
    const real = goRank.get(lead.id) ?? 1;
    const fake = fakeFronts.get(lead.eventSlug) ?? defaultFakeFront(lead.eventSlug);
    return {
      id: lead.id,
      source: "go" as const,
      name: null,
      email: null,
      eventSlug: lead.eventSlug,
      eventName: lead.eventName,
      eventDays: eventDaysForSlug(lead.eventSlug),
      quantity: lead.quantity,
      displayedPosition: real + fake,
      contactPhone: lead.contactPhone,
      contactInstagram: lead.contactInstagram,
      status: lead.status,
      acquisitionChannel: lead.acquisitionChannel,
      adminNotes: lead.adminNotes,
      createdAt: lead.createdAt,
      goLead: lead,
    };
  });

  return [...classicEntries, ...goEntries].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function listQueuePadding(): Promise<QueuePaddingRow[]> {
  const map = await getFakeFrontMap();
  return INTEREST_OPTIONS.map((opt) => ({
    eventSlug: opt.value,
    eventName: betaEventBySlug(opt.value)?.name ?? opt.label,
    fakeFront: map.get(opt.value) ?? defaultFakeFront(opt.value),
  }));
}

const fakeFrontSchema = z.object({
  eventSlug: z.string().trim().min(1).max(80),
  fakeFront: z.coerce.number().int().min(0).max(500),
});

export async function setQueueFakeFront(
  input: z.infer<typeof fakeFrontSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireBetaOpsSession();
  const parsed = fakeFrontSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid padding value." };

  const known = INTEREST_OPTIONS.some((o) => o.value === parsed.data.eventSlug);
  if (!known) return { ok: false, error: "Unknown event." };

  const admin = createAdminClient();
  const { error } = await admin.from("beta_event_queue_config").upsert(
    {
      event_slug: parsed.data.eventSlug,
      fake_front: parsed.data.fakeFront,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_slug" },
  );

  if (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "ops_set_fake_front_failed", error }));
    return { ok: false, error: "Couldn't save that." };
  }
  return { ok: true };
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
