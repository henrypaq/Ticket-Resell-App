"use server";

import { cookies } from "next/headers";
import {
  GO_CONTACT_COOKIE,
  adoptGoContactForMember,
  getGoContactById,
  getGoContactForMember,
  type GoContactProfile,
} from "@/domains/beta-go/contacts";
import { getBetaSignupId } from "@/domains/beta-signup/actions";
import {
  QUICK_BUYER_COOKIE,
  QUICK_DRAFT_COOKIE,
  QUICK_SELLER_COOKIE,
  type ProfilePrefillData,
  type QuickContactDraft,
  type QuickActionState,
  type QuickWaitlistEntry,
  type GoActivityEntry,
} from "@/domains/beta-quick/shared";
import {
  getGoActivity,
  getLeadIdentityHints,
  getQuickWaitlistEntries,
  leaveWaitlistLead,
  listBuyLeadIds,
  quickBuySchema,
  quickSellSchema,
  removeSellLead,
  submitQuickBuy,
  submitQuickEventRequest,
  submitQuickSell,
  updateWaitlistLead,
} from "@/domains/beta-quick/service";
import { QUICK_MAX_TICKETS } from "@/domains/beta-quick/shared";
import {
  BETA_ACQUISITION_COOKIE,
  BETA_LAST_SRC_COOKIE,
  isAcquisitionChannel,
  parseLastSrc,
  type AcquisitionChannel,
} from "@/lib/beta-acquisition";

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

async function readAcquisitionChannel(): Promise<AcquisitionChannel | undefined> {
  const jar = await cookies();
  const value = jar.get(BETA_ACQUISITION_COOKIE)?.value;
  return isAcquisitionChannel(value) ? value : undefined;
}

/** Last-touch campaign tag for the link that started this flow, if any. */
async function readLastSrc(): Promise<string | undefined> {
  const jar = await cookies();
  return parseLastSrc(jar.get(BETA_LAST_SRC_COOKIE)?.value) ?? undefined;
}

async function readGoContactId(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(GO_CONTACT_COOKIE)?.value;
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

async function setGoContactCookie(contactId: string): Promise<void> {
  const jar = await cookies();
  jar.set(GO_CONTACT_COOKIE, contactId, COOKIE_BASE);
}

async function appendQuickBuyerCookie(leadId: string): Promise<void> {
  const jar = await cookies();
  const existing = jar.get(QUICK_BUYER_COOKIE)?.value ?? "";
  const ids = existing
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.includes(leadId)) ids.push(leadId);
  jar.set(QUICK_BUYER_COOKIE, ids.slice(-20).join(","), COOKIE_BASE);
}

async function appendQuickSellerCookie(leadId: string): Promise<void> {
  const jar = await cookies();
  const existing = jar.get(QUICK_SELLER_COOKIE)?.value ?? "";
  const ids = existing
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.includes(leadId)) ids.push(leadId);
  jar.set(QUICK_SELLER_COOKIE, ids.slice(-20).join(","), COOKIE_BASE);
}

async function readBuyerLeadIds(): Promise<string[]> {
  const jar = await cookies();
  const raw = jar.get(QUICK_BUYER_COOKIE)?.value ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function removeBuyerLeadId(leadId: string): Promise<void> {
  const jar = await cookies();
  const ids = (await readBuyerLeadIds()).filter((id) => id !== leadId);
  if (ids.length === 0) {
    jar.delete(QUICK_BUYER_COOKIE);
  } else {
    jar.set(QUICK_BUYER_COOKIE, ids.join(","), COOKIE_BASE);
  }
}

/**
 * Who is asking — the device's /go contact cookie *and* the beta member cookie.
 * Both are consulted everywhere, because either one alone loses history: the
 * contact cookie is per-device and expires, and the member id only covers leads
 * created (or adopted) after they joined.
 *
 * Pairing them here also repairs the link: a device carrying both where the
 * contact isn't attached to any member yet gets adopted on the spot, so the
 * quick buy/sell someone did before joining follows them from then on.
 */
async function currentIdentity(): Promise<{ contactId: string | null; memberId: string | null }> {
  const [contactId, memberId] = await Promise.all([readGoContactId(), getBetaSignupId()]);
  if (contactId && memberId) {
    await adoptGoContactForMember({ contactId, memberId });
  }
  return { contactId, memberId };
}

export async function loadQuickWaitlistForHub(): Promise<QuickWaitlistEntry[]> {
  const [fromCookie, identity] = await Promise.all([readBuyerLeadIds(), currentIdentity()]);
  const fromLookup = await listBuyLeadIds(identity);
  const ids = [...new Set([...fromCookie, ...fromLookup])].slice(0, 20);
  return getQuickWaitlistEntries(ids);
}

/** Buy + sell history for this visitor — device contact cookie or member id. */
export async function loadGoActivityForHub(): Promise<GoActivityEntry[]> {
  return getGoActivity(await currentIdentity());
}

/**
 * Contact details to prefill buy/sell with. Falls back to the beta member
 * profile when this device has no /go contact yet, so a member who joined on
 * their laptop doesn't retype their phone on their phone.
 */
export async function loadSavedGoContact(): Promise<GoContactProfile | null> {
  const { contactId, memberId } = await currentIdentity();
  if (contactId) {
    const contact = await getGoContactById(contactId);
    if (contact) return contact;
  }
  if (memberId) {
    const fromMember = await getGoContactForMember(memberId);
    if (fromMember) return fromMember;
  }

  // Nothing submitted from this device yet — fall back to whatever they typed
  // into a flow they walked away from. Prefill only: `id` is a sentinel, not a
  // `beta_go_contacts` row, and is never sent back as `existingContactId`.
  const jar = await cookies();
  const draft = readDraft(jar.get(QUICK_DRAFT_COOKIE)?.value);
  if (!draft) return null;
  return {
    id: "",
    contactPhone: draft.phone ?? null,
    contactInstagram: draft.instagram ?? null,
    etransferName: draft.name ?? null,
    etransferEmail: draft.email ?? null,
    etransferPhone: null,
    memberId: null,
  };
}

/**
 * Remember what someone typed into a flow they may not finish. Called as they
 * step forward, so closing the tab on the last screen still leaves their
 * details on this device for next time — the same "the browser remembers you"
 * behaviour the contact cookie gives after a submit, just earlier.
 *
 * Best-effort by design: never surfaces an error, never blocks the step.
 */
export async function saveContactDraftAction(draft: QuickContactDraft): Promise<void> {
  const clean: QuickContactDraft = {
    phone: typeof draft.phone === "string" ? draft.phone.trim().slice(0, 30) : null,
    instagram:
      typeof draft.instagram === "string"
        ? draft.instagram.replace(/^@+/, "").trim().slice(0, 40)
        : null,
    name: typeof draft.name === "string" ? draft.name.trim().slice(0, 120) : null,
    email: typeof draft.email === "string" ? draft.email.trim().slice(0, 320) : null,
  };
  if (!clean.phone && !clean.instagram && !clean.name && !clean.email) return;

  const jar = await cookies();
  // Merge rather than replace: the buy flow collects contact on one step and
  // transfer details on another, and the second write shouldn't blank the first.
  const existing = readDraft(jar.get(QUICK_DRAFT_COOKIE)?.value);
  const merged: QuickContactDraft = {
    phone: clean.phone || existing?.phone || null,
    instagram: clean.instagram || existing?.instagram || null,
    name: clean.name || existing?.name || null,
    email: clean.email || existing?.email || null,
  };
  jar.set(QUICK_DRAFT_COOKIE, JSON.stringify(merged), COOKIE_BASE);
}

function readDraft(raw: string | undefined): QuickContactDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as QuickContactDraft;
  } catch {
    return null;
  }
}

/**
 * Everything the save-profile card can prefill, or null when this device has
 * no flow behind it — a bare `/done` hit shows the terminal copy alone rather
 * than an empty form asking a stranger to sign up.
 */
export async function loadProfilePrefill(): Promise<ProfilePrefillData | null> {
  const identity = await currentIdentity();

  const [contact, hints, referralSource] = await Promise.all([
    loadSavedGoContact(),
    getLeadIdentityHints(identity),
    readLastSrc(),
  ]);
  if (!contact && !hints) return null;

  return {
    name: hints?.name ?? contact?.etransferName ?? null,
    email: hints?.email ?? contact?.etransferEmail ?? null,
    phone: contact?.contactPhone ?? hints?.phone ?? null,
    intent: hints?.intent ?? null,
    eventName: hints?.eventName ?? null,
    referralSource: referralSource ?? null,
    contactInstagram: contact?.contactInstagram ?? null,
    etransferName: contact?.etransferName ?? hints?.name ?? null,
    etransferEmail: contact?.etransferEmail ?? null,
    etransferPhone: contact?.etransferPhone ?? null,
  };
}

export async function updateWaitlistLeadAction(
  _prev: QuickActionState,
  formData: FormData,
): Promise<QuickActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  const { contactId, memberId } = await currentIdentity();
  const result = await updateWaitlistLead({
    leadId,
    contactId,
    memberId,
    allowedLeadIds: await readBuyerLeadIds(),
    quantity: Number.isFinite(quantity) ? quantity : 1,
    contactPhone: String(formData.get("contactPhone") ?? ""),
    contactInstagram: String(formData.get("contactInstagram") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  await appendQuickBuyerCookie(result.id);
  if (result.contactId) await setGoContactCookie(result.contactId);
  return { ok: true };
}

async function readSellerLeadIds(): Promise<string[]> {
  const jar = await cookies();
  const raw = jar.get(QUICK_SELLER_COOKIE)?.value ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function removeSellerLeadId(leadId: string): Promise<void> {
  const jar = await cookies();
  const ids = (await readSellerLeadIds()).filter((id) => id !== leadId);
  if (ids.length === 0) {
    jar.delete(QUICK_SELLER_COOKIE);
  } else {
    jar.set(QUICK_SELLER_COOKIE, ids.join(","), COOKIE_BASE);
  }
}

export async function leaveWaitlistLeadAction(
  leadId: string,
): Promise<QuickActionState> {
  const { contactId, memberId } = await currentIdentity();
  const result = await leaveWaitlistLead({
    leadId,
    contactId,
    memberId,
    allowedLeadIds: await readBuyerLeadIds(),
  });
  if (!result.ok) return { error: result.error };
  await removeBuyerLeadId(leadId);
  return { ok: true };
}

export async function removeSellLeadAction(leadId: string): Promise<QuickActionState> {
  const { contactId, memberId } = await currentIdentity();
  const result = await removeSellLead({
    leadId,
    contactId,
    memberId,
    allowedLeadIds: await readSellerLeadIds(),
  });
  if (!result.ok) return { error: result.error };
  await removeSellerLeadId(leadId);
  return { ok: true };
}

export async function dismissPastSellLeadsAction(leadIds: string[]): Promise<QuickActionState> {
  const { contactId, memberId } = await currentIdentity();
  const allowed = await readSellerLeadIds();
  for (const id of leadIds) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
    await removeSellLead({ leadId: id, contactId, memberId, allowedLeadIds: allowed });
    await removeSellerLeadId(id);
  }
  return { ok: true };
}

export async function submitQuickEventRequestAction(
  _prev: QuickActionState,
  formData: FormData,
): Promise<QuickActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();

  if (!name) {
    return { error: "Please enter the event or club name." };
  }

  const memberId = await getBetaSignupId();

  const detailParts = [details, contact ? `Contact: ${contact}` : ""].filter(Boolean);
  const result = await submitQuickEventRequest({
    name,
    details: detailParts.length ? detailParts.join(" · ") : null,
    memberId,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  return {
    ok: true,
    message: `We've got your request for "${name}"! We'll do our best to support it ASAP so you can trade tickets.`,
  };
}


export async function submitQuickBuyAction(
  _prev: QuickActionState,
  formData: FormData,
): Promise<QuickActionState> {
  const parsed = quickBuySchema.safeParse({
    eventSlug: formData.get("eventSlug"),
    quantity: formData.get("quantity"),
    contactPhone: formData.get("contactPhone") || "",
    contactInstagram: formData.get("contactInstagram") || "",
    transferFirstName: formData.get("transferFirstName") || "",
    transferLastName: formData.get("transferLastName") || "",
    transferEmail: formData.get("transferEmail") || "",
    maxPriceEach: formData.get("maxPriceEach") || undefined,
    paymentDeclared: formData.get("paymentDeclared") || undefined,
    paymentAmount: formData.get("paymentAmount") || undefined,
    acquisitionChannel: await readAcquisitionChannel(),
    landingSrc: await readLastSrc(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your answers and try again." };
  }
  if (parsed.data.quantity > QUICK_MAX_TICKETS) {
    return { error: `Max ${QUICK_MAX_TICKETS} tickets.` };
  }
  const result = await submitQuickBuy({
    ...parsed.data,
    existingContactId: await readGoContactId(),
    memberId: await getBetaSignupId(),
  });
  if (!result.ok) return { error: result.error };
  await appendQuickBuyerCookie(result.id);
  if (result.contactId) await setGoContactCookie(result.contactId);
  return { ok: true, offerId: result.offerId, leadId: result.id };
}

export async function submitQuickSellAction(
  _prev: QuickActionState,
  formData: FormData,
): Promise<QuickActionState> {
  try {
    const termsOn =
      formData.get("sellerTermsAccepted") === "on" || formData.get("sellerTermsAccepted") === "1";
    const parsed = quickSellSchema.safeParse({
      eventSlug: formData.get("eventSlug"),
      quantity: formData.get("quantity"),
      paidEach: formData.get("paidEach"),
      askEach: formData.get("askEach"),
      contactPhone: formData.get("contactPhone") || "",
      contactInstagram: formData.get("contactInstagram") || "",
      ticketShareUrl: formData.get("ticketShareUrl") || "",
      etransferName: formData.get("etransferName"),
      etransferEmail: formData.get("etransferEmail") || "",
      etransferPhone: formData.get("etransferPhone") || "",
      sellerTermsAccepted: termsOn ? true : false,
      acquisitionChannel: await readAcquisitionChannel(),
      landingSrc: await readLastSrc(),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check your answers and try again." };
    }

    const uploads: { bytes: Uint8Array; name: string }[] = [];
    const all = formData.getAll("ticketImage");
    for (const raw of all) {
      if (raw instanceof File && raw.size > 0) {
        uploads.push({ bytes: new Uint8Array(await raw.arrayBuffer()), name: raw.name });
      }
    }

    const result = await submitQuickSell(
      {
        ...parsed.data,
        existingContactId: await readGoContactId(),
        memberId: await getBetaSignupId(),
      },
      uploads,
    );
    if (!result.ok) return { error: result.error };
    if (result.contactId) await setGoContactCookie(result.contactId);
    await appendQuickSellerCookie(result.id);
    return { ok: true, sellLeadId: result.id };
  } catch (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "quick_sell_action_failed", error: String(error) }));
    return { error: "Couldn't submit. Try again in a moment." };
  }
}

/** Live inventory vs queue — drives “checkout now” copy in the buy flow. */
export async function loadBuyAvailabilityAction(
  eventSlug: string,
  quantity: number,
): Promise<{
  availableUnits: number;
  demandAhead: number;
  canCheckoutNow: boolean;
} | null> {
  const slug = (eventSlug || "").trim();
  if (!slug || slug.length > 80) return null;
  const { previewBuyAvailability } = await import("@/domains/beta-matching/service");
  return previewBuyAvailability(slug, quantity);
}

async function sellerOwnsLead(sellLeadId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(sellLeadId)) return false;
  const jar = await cookies();
  const sellerIds = (jar.get(QUICK_SELLER_COOKIE)?.value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (sellerIds.includes(sellLeadId)) return true;

  const contactId = jar.get(GO_CONTACT_COOKIE)?.value ?? null;
  const memberId = await getBetaSignupId();
  const admin = (await import("@/lib/supabase/admin")).createAdminClient();
  const { data } = await admin
    .from("beta_go_leads")
    .select("contact_id, member_id, intent")
    .eq("id", sellLeadId)
    .maybeSingle();
  if (!data || data.intent !== "sell") return false;
  if (contactId && data.contact_id === contactId) return true;
  if (memberId && data.member_id === memberId) return true;
  return false;
}

/** Seller confirms Café / platform ticket transfer for ops custody queue. */
export async function declareSellerTicketSentAction(
  sellLeadId: string,
): Promise<QuickActionState> {
  if (!(await sellerOwnsLead(sellLeadId))) {
    return { error: "This listing isn't yours." };
  }
  const { declareSellerTicketSent } = await import("@/domains/beta-ops/transactions");
  const result = await declareSellerTicketSent(sellLeadId);
  if (!result.ok) return { error: result.error };
  // notifyOpsSellerTicketDeclared is intentionally not called yet (unwired).
  return { ok: true, message: "Thanks — we'll confirm once we see the ticket." };
}

/**
 * Fixed-price post-checkout queue card — only if this device/member owns the lead.
 */
export async function loadQueueSeatForBuyer(
  leadId: string,
): Promise<QuickWaitlistEntry | null> {
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) return null;
  const [fromCookie, identity, contactId] = await Promise.all([
    readBuyerLeadIds(),
    currentIdentity(),
    readGoContactId(),
  ]);
  const fromLookup = await listBuyLeadIds(identity);
  const allowed = new Set([...fromCookie, ...fromLookup]);
  if (!allowed.has(leadId)) {
    // Cookie race after join: contact ownership still proves this device.
    if (!contactId) return null;
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
    const { data } = await admin
      .from("beta_go_leads")
      .select("id, contact_id")
      .eq("id", leadId)
      .eq("intent", "buy")
      .maybeSingle();
    if (!data || (data.contact_id as string | null) !== contactId) return null;
    await appendQuickBuyerCookie(leadId);
  }
  const entries = await getQuickWaitlistEntries([leadId]);
  return entries[0] ?? null;
}
