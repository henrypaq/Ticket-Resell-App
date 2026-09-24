import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getTicketEvidenceSignedUrls } from "@/domains/beta-ops/service";
import { loadBetaCatalog } from "@/domains/beta-events/catalog";
import type {
  OpsCompletedItem,
  OpsFixedPriceTxnItem,
  OpsForwardTicketItem,
  OpsPaymentQueueItem,
  OpsPayoutItem,
  OpsPerson,
  OpsTicketCustodyItem,
  OpsTransactionsBoard,
} from "@/domains/beta-ops/transaction-types";

export type {
  OpsCompletedItem,
  OpsFixedPriceTxnItem,
  OpsForwardTicketItem,
  OpsPaymentQueueItem,
  OpsPayoutItem,
  OpsPerson,
  OpsTicketCustodyItem,
  OpsTransactionsBoard,
} from "@/domains/beta-ops/transaction-types";

function emptyPerson(): OpsPerson {
  return {
    name: null,
    email: null,
    phone: null,
    instagram: null,
    etransferEmail: null,
    etransferPhone: null,
  };
}

function personFromLead(row: {
  etransfer_name?: string | null;
  etransfer_email?: string | null;
  etransfer_phone?: string | null;
  contact_phone?: string | null;
  contact_instagram?: string | null;
  transfer_first_name?: string | null;
  transfer_last_name?: string | null;
  transfer_email?: string | null;
  contact?: {
    etransfer_name?: string | null;
    contact_phone?: string | null;
    contact_instagram?: string | null;
    etransfer_email?: string | null;
    etransfer_phone?: string | null;
  } | null;
}): OpsPerson {
  const c = row.contact;
  const transferName = [row.transfer_first_name, row.transfer_last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return {
    name: row.etransfer_name || transferName || c?.etransfer_name || null,
    email: row.transfer_email || null,
    phone: row.contact_phone ?? c?.contact_phone ?? null,
    instagram: row.contact_instagram ?? c?.contact_instagram ?? null,
    etransferEmail: row.etransfer_email ?? c?.etransfer_email ?? null,
    etransferPhone: row.etransfer_phone ?? c?.etransfer_phone ?? null,
  };
}

function memoFromOfferId(offerId: string): string {
  return `MT-${offerId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/**
 * Four actionable queues for the ops Transactions hub, plus a short completed tail.
 * Ordered so “someone is waiting on you” surfaces first.
 */
export async function listOpsTransactions(): Promise<OpsTransactionsBoard> {
  const admin = createAdminClient();
  const catalog = await loadBetaCatalog();
  const nameFor = (slug: string) => catalog.find((e) => e.slug === slug)?.name ?? slug;

  const [{ data: paymentOffers }, { data: custodyLeads }, { data: paidOffers }, { data: fixedPriceLeads }] =
    await Promise.all([
    admin
      .from("beta_offers")
      .select(
        "id, unit_id, buy_lead_id, event_slug, price_each, status, buyer_declared_sent_at, payment_due_at, payment_amount, payment_recorded_at, ticket_transferred_at, payout_released_at",
      )
      .eq("status", "accepted")
      .not("buyer_declared_sent_at", "is", null)
      .order("buyer_declared_sent_at", { ascending: true })
      .limit(50),
    admin
      .from("beta_go_leads")
      .select(
        "id, event_slug, quantity, ask_each, etransfer_name, etransfer_email, etransfer_phone, contact_phone, contact_instagram, ticket_share_url, ticket_evidence_path, seller_ticket_sent_at, ticket_received_at, contact_id",
      )
      .eq("intent", "sell")
      .neq("status", "cancelled")
      .not("seller_ticket_sent_at", "is", null)
      .is("ticket_received_at", null)
      .order("seller_ticket_sent_at", { ascending: true })
      .limit(50),
    admin
      .from("beta_offers")
      .select(
        "id, unit_id, buy_lead_id, event_slug, price_each, status, payment_amount, payment_recorded_at, ticket_transferred_at, payout_released_at, seller_payout_confirmed_at",
      )
      .eq("status", "paid")
      .order("payment_recorded_at", { ascending: true })
      .limit(80),
    admin
      .from("beta_go_leads")
      .select(
        "id, event_slug, quantity, status, max_price_each, payment_amount, buyer_declared_sent_at, payment_recorded_at, ticket_forwarded_at, contact_phone, contact_instagram, transfer_first_name, transfer_last_name, transfer_email, contact_id",
      )
      .eq("intent", "buy")
      .neq("status", "cancelled")
      .not("buyer_declared_sent_at", "is", null)
      .order("buyer_declared_sent_at", { ascending: true })
      .limit(80),
  ]);

  const unitIds = [
    ...new Set(
      [...(paymentOffers ?? []), ...(paidOffers ?? [])]
        .map((o) => o.unit_id as string)
        .filter(Boolean),
    ),
  ];
  const buyLeadIds = [
    ...new Set(
      [...(paymentOffers ?? []), ...(paidOffers ?? [])]
        .map((o) => o.buy_lead_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const contactIds = [
    ...new Set(
      [
        ...(custodyLeads ?? []).map((l) => l.contact_id as string | null),
        ...(fixedPriceLeads ?? []).map((l) => l.contact_id as string | null),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: units }, { data: buyLeads }, { data: contacts }] = await Promise.all([
    unitIds.length
      ? admin
          .from("beta_ticket_units")
          .select("id, sell_lead_id")
          .in("id", unitIds)
      : Promise.resolve({ data: [] as { id: string; sell_lead_id: string }[] }),
    buyLeadIds.length
      ? admin
          .from("beta_go_leads")
          .select(
            "id, etransfer_name, etransfer_email, etransfer_phone, contact_phone, contact_instagram, contact_id, transfer_first_name, transfer_last_name, transfer_email",
          )
          .in("id", buyLeadIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    contactIds.length
      ? admin
          .from("beta_go_contacts")
          .select(
            "id, contact_phone, contact_instagram, etransfer_name, etransfer_email, etransfer_phone",
          )
          .in("id", contactIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const sellLeadIds = [
    ...new Set((units ?? []).map((u) => u.sell_lead_id as string).filter(Boolean)),
  ];
  const { data: sellLeads } =
    sellLeadIds.length > 0
      ? await admin
          .from("beta_go_leads")
          .select(
            "id, etransfer_name, etransfer_email, etransfer_phone, contact_phone, contact_instagram, ticket_received_at, contact_id",
          )
          .in("id", sellLeadIds)
      : { data: [] as Record<string, unknown>[] };

  const moreContactIds = [
    ...new Set(
      [...(buyLeads ?? []), ...(sellLeads ?? [])]
        .map((l) => l.contact_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ].filter((id) => !contactIds.includes(id));

  const { data: moreContacts } =
    moreContactIds.length > 0
      ? await admin
          .from("beta_go_contacts")
          .select(
            "id, contact_phone, contact_instagram, etransfer_name, etransfer_email, etransfer_phone",
          )
          .in("id", moreContactIds)
      : { data: [] as Record<string, unknown>[] };

  const contactById = new Map<string, Record<string, unknown>>();
  for (const c of [...(contacts ?? []), ...(moreContacts ?? [])]) {
    contactById.set(c.id as string, c);
  }
  const unitById = new Map((units ?? []).map((u) => [u.id as string, u]));
  const buyById = new Map((buyLeads ?? []).map((l) => [l.id as string, l]));
  const sellById = new Map((sellLeads ?? []).map((l) => [l.id as string, l]));

  function withContact(lead: Record<string, unknown> | undefined): OpsPerson {
    if (!lead) return emptyPerson();
    const contactId = lead.contact_id as string | null;
    const contact = contactId ? contactById.get(contactId) ?? null : null;
    return personFromLead({
      etransfer_name: lead.etransfer_name as string | null,
      etransfer_email: lead.etransfer_email as string | null,
      etransfer_phone: lead.etransfer_phone as string | null,
      contact_phone: lead.contact_phone as string | null,
      contact_instagram: lead.contact_instagram as string | null,
      transfer_first_name: lead.transfer_first_name as string | null,
      transfer_last_name: lead.transfer_last_name as string | null,
      transfer_email: lead.transfer_email as string | null,
      contact: contact
        ? {
            etransfer_name: contact.etransfer_name as string | null,
            contact_phone: contact.contact_phone as string | null,
            contact_instagram: contact.contact_instagram as string | null,
            etransfer_email: contact.etransfer_email as string | null,
            etransfer_phone: contact.etransfer_phone as string | null,
          }
        : null,
    });
  }

  const paymentsToVerify: OpsPaymentQueueItem[] = (paymentOffers ?? []).map((o) => {
    const unit = unitById.get(o.unit_id as string);
    const buy = o.buy_lead_id ? buyById.get(o.buy_lead_id as string) : undefined;
    const sell = unit ? sellById.get(unit.sell_lead_id as string) : undefined;
    return {
      kind: "payment_verify",
      offerId: o.id as string,
      eventSlug: o.event_slug as string,
      eventName: nameFor(o.event_slug as string),
      priceEach: Number(o.price_each),
      memoHint: memoFromOfferId(o.id as string),
      buyerDeclaredSentAt: o.buyer_declared_sent_at as string,
      paymentDueAt: (o.payment_due_at as string | null) ?? null,
      buyer: withContact(buy),
      seller: withContact(sell),
    };
  });

  const ticketsToVerify: OpsTicketCustodyItem[] = [];
  for (const lead of custodyLeads ?? []) {
    const evidenceUrls = await getTicketEvidenceSignedUrls(
      (lead.ticket_evidence_path as string | null) ?? null,
    );
    ticketsToVerify.push({
      kind: "ticket_verify",
      sellLeadId: lead.id as string,
      eventSlug: lead.event_slug as string,
      eventName: nameFor(lead.event_slug as string),
      quantity: Number(lead.quantity) || 1,
      askEach: lead.ask_each != null ? Number(lead.ask_each) : null,
      sellerTicketSentAt: lead.seller_ticket_sent_at as string,
      evidenceUrls,
      ticketShareUrl: (lead.ticket_share_url as string | null) ?? null,
      seller: withContact(lead as Record<string, unknown>),
    });
  }

  const ticketsToForward: OpsForwardTicketItem[] = [];
  const payoutsToSend: OpsPayoutItem[] = [];
  const recentlyCompleted: OpsCompletedItem[] = [];

  for (const o of paidOffers ?? []) {
    const unit = unitById.get(o.unit_id as string);
    const buy = o.buy_lead_id ? buyById.get(o.buy_lead_id as string) : undefined;
    const sell = unit ? sellById.get(unit.sell_lead_id as string) : undefined;
    const name = nameFor(o.event_slug as string);
    const amount = Number(o.payment_amount ?? o.price_each);
    const sellLeadId = unit ? (unit.sell_lead_id as string) : null;
    const ticketReceivedAt =
      sell && sell.ticket_received_at ? (sell.ticket_received_at as string) : null;

    if (o.payout_released_at) {
      recentlyCompleted.push({
        offerId: o.id as string,
        eventSlug: o.event_slug as string,
        eventName: name,
        amount,
        payoutReleasedAt: o.payout_released_at as string,
        sellerPayoutConfirmedAt:
          (o.seller_payout_confirmed_at as string | null) ?? null,
        ticketForwardedAt: (o.ticket_transferred_at as string | null) ?? null,
        buyerName: withContact(buy).name,
        sellerName: withContact(sell).name,
      });
      continue;
    }

    if (!o.ticket_transferred_at) {
      ticketsToForward.push({
        kind: "ticket_forward",
        offerId: o.id as string,
        sellLeadId,
        eventSlug: o.event_slug as string,
        eventName: name,
        priceEach: Number(o.price_each),
        paidAt: (o.payment_recorded_at as string | null) ?? null,
        ticketReceivedAt,
        buyer: withContact(buy),
        seller: withContact(sell),
      });
    }

    payoutsToSend.push({
      kind: "payout",
      offerId: o.id as string,
      sellLeadId,
      eventSlug: o.event_slug as string,
      eventName: name,
      amount,
      ticketForwardedAt: (o.ticket_transferred_at as string | null) ?? null,
      seller: withContact(sell),
    });
  }

  recentlyCompleted.sort((a, b) => b.payoutReleasedAt.localeCompare(a.payoutReleasedAt));

  const fixedPriceTxns: OpsFixedPriceTxnItem[] = (fixedPriceLeads ?? []).map((lead) => {
    const qty = Math.max(1, Number(lead.quantity) || 1);
    const amount =
      lead.payment_amount != null && Number.isFinite(Number(lead.payment_amount))
        ? Number(lead.payment_amount)
        : lead.max_price_each != null
          ? Math.round(Number(lead.max_price_each) * qty * 100) / 100
          : 0;
    const paymentRecordedAt = (lead.payment_recorded_at as string | null) ?? null;
    const ticketForwardedAt = (lead.ticket_forwarded_at as string | null) ?? null;
    const status: OpsFixedPriceTxnItem["status"] = ticketForwardedAt
      ? "done"
      : paymentRecordedAt
        ? "awaiting_ticket"
        : "awaiting_payment";
    return {
      kind: "fixed_price" as const,
      leadId: lead.id as string,
      eventSlug: lead.event_slug as string,
      eventName: nameFor(lead.event_slug as string),
      quantity: qty,
      amount,
      memoHint: `MT-${String(lead.event_slug).slice(0, 28)}`.toUpperCase(),
      buyerDeclaredSentAt: lead.buyer_declared_sent_at as string,
      paymentRecordedAt,
      ticketForwardedAt,
      buyer: withContact(lead as Record<string, unknown>),
      status,
    };
  });

  const openFixedPrice = fixedPriceTxns.filter((t) => t.status !== "done");

  const attentionCount =
    paymentsToVerify.length +
    ticketsToVerify.length +
    ticketsToForward.length +
    payoutsToSend.length +
    openFixedPrice.length;

  return {
    paymentsToVerify,
    ticketsToVerify,
    ticketsToForward,
    payoutsToSend,
    fixedPriceTxns,
    recentlyCompleted: recentlyCompleted.slice(0, 12),
    attentionCount,
  };
}

export async function declareSellerTicketSent(
  sellLeadId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("declare_seller_ticket_sent", {
    p_sell_lead_id: sellLeadId,
  });
  if (error) return { ok: false, error: error.message };
  const outcome = (data ?? {}) as { ok?: boolean; error?: string };
  if (!outcome.ok) return { ok: false, error: outcome.error ?? "Could not record the transfer." };
  // No ops email here — ops only gets buyer payment-declared + seller listed.
  return { ok: true, id: sellLeadId };
}

export async function markSellTicketReceived(
  sellLeadId: string,
  recordedBy = "ops",
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("beta_go_leads")
    .select("id, intent, event_slug, ask_each, ticket_received_at")
    .eq("id", sellLeadId)
    .maybeSingle();
  if (error || !lead) return { ok: false, error: "Listing not found." };
  const alreadyReceived = Boolean(lead.ticket_received_at);

  // Locks the lead, re-checks that the seller declared the transfer, and stamps
  // custody with the operator's name attached (migration 20260923090200).
  const { data: received, error: rpcError } = await admin.rpc("confirm_ticket_received", {
    p_sell_lead_id: sellLeadId,
    p_actor_label: recordedBy,
  });
  if (rpcError) return { ok: false, error: rpcError.message };
  const outcome = (received ?? {}) as { ok?: boolean; error?: string };
  if (!outcome.ok) return { ok: false, error: outcome.error ?? "Could not confirm receipt." };
  if (alreadyReceived) return { ok: true, id: sellLeadId };

  const { notifySellLead } = await import("@/domains/beta-matching/notify");
  void notifySellLead({
    kind: "seller_ticket_received",
    sellLeadId,
    priceEach: lead.ask_each != null ? Number(lead.ask_each) : 0,
    eventSlug: lead.event_slug as string,
  });

  return { ok: true, id: sellLeadId };
}

/** Ops: confirm fixed-price buyer Interac landed. */
export async function markFixedPricePaymentReceived(
  leadId: string,
  recordedBy = "ops",
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
    return { ok: false, error: "Invalid lead." };
  }
  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("beta_go_leads")
    .select("id, intent, buyer_declared_sent_at, payment_recorded_at, status")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !lead || lead.intent !== "buy") {
    return { ok: false, error: "Buy lead not found." };
  }
  if (!lead.buyer_declared_sent_at) {
    return { ok: false, error: "Buyer hasn’t declared payment yet." };
  }
  if (lead.payment_recorded_at) return { ok: true, id: leadId };

  const { error: updateError } = await admin
    .from("beta_go_leads")
    .update({
      payment_recorded_at: new Date().toISOString(),
      payment_recorded_by: recordedBy.slice(0, 120),
      status: lead.status === "new" ? "contacted" : lead.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, id: leadId };
}

/** Ops: confirm fixed-price ticket was sent to the buyer’s transfer email. */
export async function markFixedPriceTicketForwarded(
  leadId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
    return { ok: false, error: "Invalid lead." };
  }
  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("beta_go_leads")
    .select("id, intent, payment_recorded_at, ticket_forwarded_at")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !lead || lead.intent !== "buy") {
    return { ok: false, error: "Buy lead not found." };
  }
  if (!lead.payment_recorded_at) {
    return { ok: false, error: "Confirm Interac received before marking the ticket sent." };
  }
  if (lead.ticket_forwarded_at) return { ok: true, id: leadId };

  const { error: updateError } = await admin
    .from("beta_go_leads")
    .update({
      ticket_forwarded_at: new Date().toISOString(),
      status: "done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, id: leadId };
}
