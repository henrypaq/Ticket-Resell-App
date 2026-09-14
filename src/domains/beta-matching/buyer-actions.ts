"use server";

import { cookies } from "next/headers";
import {
  acceptOffer,
  declineOffer,
  getOfferForBuyer,
  reactivateSeat,
} from "@/domains/beta-matching/service";
import { GO_CONTACT_COOKIE } from "@/domains/beta-go/contacts";
import { QUICK_BUYER_COOKIE } from "@/domains/beta-quick/shared";
import { getBetaSignupId } from "@/domains/beta-signup/actions";
import { createAdminClient } from "@/lib/supabase/admin";

export type OfferActionState = { ok?: true; error?: string; message?: string };

async function buyerOwnsOffer(offerId: string): Promise<boolean> {
  const offer = await getOfferForBuyer(offerId);
  if (!offer) return false;

  const jar = await cookies();
  const contactId = jar.get(GO_CONTACT_COOKIE)?.value ?? null;
  const buyerIds = (jar.get(QUICK_BUYER_COOKIE)?.value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const memberId = await getBetaSignupId();

  if (offer.buy_lead_id) {
    if (buyerIds.includes(offer.buy_lead_id)) return true;
    const admin = createAdminClient();
    const { data } = await admin
      .from("beta_go_leads")
      .select("contact_id, member_id")
      .eq("id", offer.buy_lead_id)
      .maybeSingle();
    if (contactId && data?.contact_id === contactId) return true;
    if (memberId && data?.member_id === memberId) return true;
  }

  if (offer.classic_interest_id && memberId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("beta_member_interests")
      .select("member_id")
      .eq("id", offer.classic_interest_id)
      .maybeSingle();
    if (data?.member_id === memberId) return true;
  }

  return false;
}

export async function buyerAcceptOfferAction(offerId: string): Promise<OfferActionState> {
  if (!(await buyerOwnsOffer(offerId))) return { error: "This offer isn't yours." };
  const result = await acceptOffer(offerId);
  if (!result.ok) return { error: result.error };
  return { ok: true, message: "You're in — send the Interac e-transfer before the payment deadline." };
}

export async function buyerDeclineOfferAction(
  offerId: string,
  reason: "price" | "not_going" | "other",
): Promise<OfferActionState> {
  if (!(await buyerOwnsOffer(offerId))) return { error: "This offer isn't yours." };
  const result = await declineOffer(offerId, reason);
  if (!result.ok) return { error: result.error };
  return {
    ok: true,
    message:
      reason === "not_going"
        ? "Got it — you're off this waitlist."
        : "Passed. You're still in line for a better match.",
  };
}

export async function buyerReactivateSeatAction(seatKey: string): Promise<OfferActionState> {
  const jar = await cookies();
  const contactId = jar.get(GO_CONTACT_COOKIE)?.value ?? null;
  const buyerIds = (jar.get(QUICK_BUYER_COOKIE)?.value ?? "").split(",").filter(Boolean);
  const memberId = await getBetaSignupId();

  let owns = false;
  if (seatKey.startsWith("go:")) {
    const leadId = seatKey.slice(3);
    if (buyerIds.includes(leadId)) owns = true;
    else if (contactId) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("beta_go_leads")
        .select("contact_id, member_id")
        .eq("id", leadId)
        .maybeSingle();
      if (data?.contact_id === contactId) owns = true;
      if (memberId && data?.member_id === memberId) owns = true;
    } else if (memberId) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("beta_go_leads")
        .select("member_id")
        .eq("id", leadId)
        .maybeSingle();
      if (data?.member_id === memberId) owns = true;
    }
  } else if (seatKey.startsWith("classic:") && memberId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("beta_member_interests")
      .select("member_id")
      .eq("id", seatKey.slice(8))
      .maybeSingle();
    owns = data?.member_id === memberId;
  }

  if (!owns) return { error: "That waitlist seat isn't yours." };

  const result = await reactivateSeat(seatKey);
  if (!result.ok) return { error: result.error };
  return { ok: true, message: "You're active again — we'll hold matching tickets for you." };
}
