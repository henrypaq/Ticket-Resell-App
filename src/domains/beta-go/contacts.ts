import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { GO_CONTACT_COOKIE, type GoContactProfile } from "@/domains/beta-go/shared";

export { GO_CONTACT_COOKIE, type GoContactProfile } from "@/domains/beta-go/shared";


function normalizeIg(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/^@+/, "").replace(/\s+/g, "");
  return v.length >= 2 ? v.toLowerCase() : null;
}

function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 7) return null;
  // Prefer E.164-ish storage when already has +
  const trimmed = (raw ?? "").trim();
  if (trimmed.startsWith("+") && trimmed.replace(/\D/g, "").length >= 7) return trimmed;
  return `+${digits}`;
}

function mapContact(row: Record<string, unknown>): GoContactProfile {
  return {
    id: String(row.id),
    contactPhone: (row.contact_phone as string | null) ?? null,
    contactInstagram: (row.contact_instagram as string | null) ?? null,
    etransferName: (row.etransfer_name as string | null) ?? null,
    etransferEmail: (row.etransfer_email as string | null) ?? null,
    etransferPhone: (row.etransfer_phone as string | null) ?? null,
    memberId: (row.member_id as string | null) ?? null,
  };
}

export async function getGoContactById(id: string): Promise<GoContactProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("beta_go_contacts").select("*").eq("id", id).maybeSingle();
  return data ? mapContact(data as Record<string, unknown>) : null;
}

/** Find a beta member id by phone (normalized digits) or email. */
export async function findMemberIdByContact(input: {
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
}): Promise<string | null> {
  const admin = createAdminClient();
  const phone = normalizePhone(input.phone);
  const email = (input.email ?? "").trim().toLowerCase();

  if (email) {
    const { data } = await admin.from("beta_members").select("id").eq("email", email).maybeSingle();
    if (data?.id) return data.id;
  }

  if (phone) {
    const digits = phone.replace(/\D/g, "");
    const { data } = await admin.from("beta_members").select("id, phone").limit(300);
    const match = (data ?? []).find((row) => row.phone?.replace(/\D/g, "") === digits);
    if (match?.id) return match.id;
  }

  return null;
}

/**
 * Upsert a thin /go contact from buy/sell details. Returns the contact id.
 * Also attaches member_id when a matching beta member already exists.
 */
export async function upsertGoContact(input: {
  contactPhone?: string | null;
  contactInstagram?: string | null;
  etransferName?: string | null;
  etransferEmail?: string | null;
  etransferPhone?: string | null;
  existingContactId?: string | null;
}): Promise<{ ok: true; contact: GoContactProfile } | { ok: false; error: string }> {
  const phone = normalizePhone(input.contactPhone);
  const ig = normalizeIg(input.contactInstagram);
  if (!phone && !ig) {
    return { ok: false, error: "Need a phone or Instagram to save contact." };
  }

  const admin = createAdminClient();
  let existing: Record<string, unknown> | null = null;

  if (input.existingContactId && /^[0-9a-f-]{36}$/i.test(input.existingContactId)) {
    const { data } = await admin
      .from("beta_go_contacts")
      .select("*")
      .eq("id", input.existingContactId)
      .maybeSingle();
    existing = (data as Record<string, unknown> | null) ?? null;
  }

  if (!existing && phone) {
    const { data } = await admin
      .from("beta_go_contacts")
      .select("*")
      .eq("contact_phone", phone)
      .maybeSingle();
    existing = (data as Record<string, unknown> | null) ?? null;
  }

  if (!existing && ig) {
    const { data } = await admin
      .from("beta_go_contacts")
      .select("*")
      .ilike("contact_instagram", ig)
      .maybeSingle();
    existing = (data as Record<string, unknown> | null) ?? null;
  }

  const memberId =
    (existing?.member_id as string | null) ??
    (await findMemberIdByContact({ phone, email: input.etransferEmail, instagram: ig }));

  const patch = {
    contact_phone: phone ?? (existing?.contact_phone as string | null) ?? null,
    contact_instagram: ig ?? (existing?.contact_instagram as string | null) ?? null,
    etransfer_name: input.etransferName || (existing?.etransfer_name as string | null) || null,
    etransfer_email: input.etransferEmail || (existing?.etransfer_email as string | null) || null,
    etransfer_phone: normalizePhone(input.etransferPhone) ||
      (existing?.etransfer_phone as string | null) ||
      null,
    member_id: memberId,
    last_seen_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await admin
      .from("beta_go_contacts")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (!error && data) {
      await linkGoLeadsToContact(String(data.id), memberId);
      return { ok: true, contact: mapContact(data as Record<string, unknown>) };
    }
    // Unique phone/IG conflict: fall through to the row that already owns that identity.
    if (error?.code !== "23505") {
      console.warn(JSON.stringify({ level: "warn", msg: "go_contact_update_failed", error }));
      return { ok: false, error: "Couldn't save contact." };
    }
  }

  const { data, error } = await admin
    .from("beta_go_contacts")
    .insert(patch)
    .select("*")
    .single();
  if (!error && data) {
    await linkGoLeadsToContact(String(data.id), memberId);
    return { ok: true, contact: mapContact(data as Record<string, unknown>) };
  }

  // Race / unique conflict: load the winning row and refresh etransfer fields.
  if (error && error.code !== "23505") {
    console.warn(JSON.stringify({ level: "warn", msg: "go_contact_insert_failed", error }));
    return { ok: false, error: "Couldn't save contact." };
  }

  let winner: Record<string, unknown> | null = null;
  if (phone) {
    const { data: byPhone } = await admin
      .from("beta_go_contacts")
      .select("*")
      .eq("contact_phone", phone)
      .maybeSingle();
    winner = (byPhone as Record<string, unknown> | null) ?? null;
  }
  if (!winner && ig) {
    const { data: byIg } = await admin
      .from("beta_go_contacts")
      .select("*")
      .ilike("contact_instagram", ig)
      .maybeSingle();
    winner = (byIg as Record<string, unknown> | null) ?? null;
  }
  if (!winner?.id) {
    return { ok: false, error: "Couldn't save contact." };
  }

  const { data: refreshed, error: refreshError } = await admin
    .from("beta_go_contacts")
    .update({
      etransfer_name: patch.etransfer_name,
      etransfer_email: patch.etransfer_email,
      etransfer_phone: patch.etransfer_phone,
      member_id: memberId ?? (winner.member_id as string | null),
      last_seen_at: patch.last_seen_at,
    })
    .eq("id", winner.id)
    .select("*")
    .single();
  if (refreshError || !refreshed) {
    console.warn(JSON.stringify({ level: "warn", msg: "go_contact_refresh_failed", error: refreshError }));
    return { ok: false, error: "Couldn't save contact." };
  }
  await linkGoLeadsToContact(String(refreshed.id), memberId);
  return { ok: true, contact: mapContact(refreshed as Record<string, unknown>) };
}

async function linkGoLeadsToContact(contactId: string, memberId: string | null) {
  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("beta_go_contacts")
    .select("contact_phone, contact_instagram")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return;

  const patch = {
    contact_id: contactId,
    ...(memberId ? { member_id: memberId } : {}),
  };

  if (contact.contact_phone) {
    await admin
      .from("beta_go_leads")
      .update(patch)
      .is("contact_id", null)
      .eq("contact_phone", contact.contact_phone);
  }
  if (contact.contact_instagram) {
    await admin
      .from("beta_go_leads")
      .update(patch)
      .is("contact_id", null)
      .ilike("contact_instagram", contact.contact_instagram);
  }
}

/** When someone becomes a beta member, attach prior /go contacts + leads. */
export async function linkMemberToGoHistory(input: {
  memberId: string;
  phone?: string | null;
  email?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const phone = normalizePhone(input.phone);
  if (!phone && !input.email) return;

  if (phone) {
    await admin
      .from("beta_go_contacts")
      .update({ member_id: input.memberId, last_seen_at: new Date().toISOString() })
      .eq("contact_phone", phone);

    await admin
      .from("beta_go_leads")
      .update({ member_id: input.memberId })
      .eq("contact_phone", phone);
  }

  // Also attach leads via contacts that now have this member_id
  const { data: contacts } = await admin
    .from("beta_go_contacts")
    .select("id")
    .eq("member_id", input.memberId);
  const ids = (contacts ?? []).map((c) => c.id);
  if (ids.length) {
    await admin.from("beta_go_leads").update({ member_id: input.memberId }).in("contact_id", ids);
  }
}
