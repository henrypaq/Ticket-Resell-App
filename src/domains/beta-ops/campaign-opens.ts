import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseLastSrc } from "@/lib/beta-acquisition";
import { requireBetaOpsSession } from "@/domains/beta-ops/auth";
import type {
  CampaignLinkConvert,
  CampaignLinkOpen,
  CampaignLinkStats,
} from "@/domains/beta-ops/campaign-open-types";

export type {
  CampaignLinkConvert,
  CampaignLinkOpen,
  CampaignLinkStats,
} from "@/domains/beta-ops/campaign-open-types";

function uaSummary(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  if (/instagram/i.test(ua)) return "Instagram";
  if (/iphone|ipad/i.test(ua)) return "iPhone";
  if (/android/i.test(ua)) return "Android";
  if (/macintosh/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows";
  return "Browser";
}

function contactLabel(row: {
  contact_phone?: string | null;
  contact_instagram?: string | null;
  transfer_first_name?: string | null;
  transfer_last_name?: string | null;
  etransfer_name?: string | null;
}): string {
  const name = [row.transfer_first_name, row.transfer_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (name) return name;
  if (row.etransfer_name?.trim()) return row.etransfer_name.trim();
  if (row.contact_instagram) return `@${row.contact_instagram.replace(/^@+/, "")}`;
  if (row.contact_phone) return row.contact_phone;
  return "Visitor";
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/** Record a campaign link open (called from the public track API). */
export async function recordCampaignLinkOpen(input: {
  src: string;
  path?: string | null;
  userAgent?: string | null;
  contactId?: string | null;
  memberId?: string | null;
  ip?: string | null;
}): Promise<void> {
  const src = parseLastSrc(input.src);
  if (!src) return;

  const admin = createAdminClient();
  const contactId =
    input.contactId && /^[0-9a-f-]{36}$/i.test(input.contactId) ? input.contactId : null;
  const memberId =
    input.memberId && /^[0-9a-f-]{36}$/i.test(input.memberId) ? input.memberId : null;

  const { error } = await admin.from("beta_campaign_link_opens").insert({
    src,
    path: (input.path ?? "").slice(0, 200) || null,
    user_agent: (input.userAgent ?? "").slice(0, 400) || null,
    contact_id: contactId,
    member_id: memberId,
    ip_hash: hashIp(input.ip),
  });

  if (error) {
    console.warn(
      JSON.stringify({ level: "warn", msg: "campaign_link_open_failed", error, src }),
    );
  }
}

export async function getCampaignLinkStats(srcRaw: string): Promise<CampaignLinkStats> {
  await requireBetaOpsSession();
  const src = parseLastSrc(srcRaw);
  if (!src) {
    return { src: "", openCount: 0, opens: [], converts: [] };
  }

  const admin = createAdminClient();
  const [{ data: openRows, count }, { data: leadRows }] = await Promise.all([
    admin
      .from("beta_campaign_link_opens")
      .select("id, src, opened_at, path, user_agent, contact_id", { count: "exact" })
      .eq("src", src)
      .order("opened_at", { ascending: false })
      .limit(80),
    admin
      .from("beta_go_leads")
      .select(
        "id, intent, event_slug, created_at, contact_phone, contact_instagram, transfer_first_name, transfer_last_name",
      )
      .eq("acquisition_channel", src)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const contactIds = [
    ...new Set(
      (openRows ?? [])
        .map((r) => r.contact_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const contactById = new Map<
    string,
    {
      contact_phone?: string | null;
      contact_instagram?: string | null;
      etransfer_name?: string | null;
    }
  >();
  if (contactIds.length > 0) {
    const { data: contacts } = await admin
      .from("beta_go_contacts")
      .select("id, contact_phone, contact_instagram, etransfer_name")
      .in("id", contactIds);
    for (const c of contacts ?? []) {
      contactById.set(c.id as string, c as {
        contact_phone?: string | null;
        contact_instagram?: string | null;
        etransfer_name?: string | null;
      });
    }
  }

  const opens: CampaignLinkOpen[] = (openRows ?? []).map((row) => {
    const contact = row.contact_id
      ? contactById.get(row.contact_id as string)
      : undefined;
    const label = contact
      ? contactLabel(contact)
      : uaSummary(row.user_agent as string | null);
    return {
      id: row.id as string,
      src: row.src as string,
      openedAt: row.opened_at as string,
      path: (row.path as string | null) ?? null,
      userAgent: (row.user_agent as string | null) ?? null,
      contactId: (row.contact_id as string | null) ?? null,
      label,
    };
  });

  const converts: CampaignLinkConvert[] = (leadRows ?? []).map((row) => ({
    leadId: row.id as string,
    createdAt: row.created_at as string,
    intent: row.intent as string,
    eventSlug: row.event_slug as string,
    label: contactLabel(row as Record<string, string | null>),
  }));

  return {
    src,
    openCount: count ?? opens.length,
    opens,
    converts,
  };
}
