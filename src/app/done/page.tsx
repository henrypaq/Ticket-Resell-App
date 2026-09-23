import { DoneScreen } from "@/components/app/done";
import { loadProfilePrefill } from "@/domains/beta-quick/actions";
import { loadBetaProfile } from "@/domains/beta-signup/actions";
import { platformTicketTransfer } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You're in · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Success screen, and the entry into optional account setup. Someone who
 * already has a profile sees the terminal copy alone; everyone else gets a
 * short prompt that links to `/setup`.
 */
export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; offer?: string; event?: string; lead?: string }>;
}) {
  const params = await searchParams;
  const intent = params.intent === "sell" ? "sell" : "buy";
  const offerId = params.offer && /^[0-9a-f-]{36}$/i.test(params.offer) ? params.offer : null;
  const sellLeadId = params.lead && /^[0-9a-f-]{36}$/i.test(params.lead) ? params.lead : null;
  const cafeSell = intent === "sell" && params.event === "cafe-campus";

  const [profile, prefill, sellerTicketSentAt] = await Promise.all([
    loadBetaProfile(),
    loadProfilePrefill(),
    sellLeadId && cafeSell ? loadSellerTicketSentAt(sellLeadId) : Promise.resolve(null),
  ]);

  return (
    <DoneScreen
      intent={intent}
      prefill={profile ? null : prefill}
      hasProfile={Boolean(profile)}
      offerId={offerId}
      cafeTransfer={cafeSell ? platformTicketTransfer() : null}
      sellLeadId={cafeSell ? sellLeadId : null}
      sellerTicketSentAt={sellerTicketSentAt}
    />
  );
}

async function loadSellerTicketSentAt(sellLeadId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("beta_go_leads")
    .select("seller_ticket_sent_at")
    .eq("id", sellLeadId)
    .maybeSingle();
  return (data?.seller_ticket_sent_at as string | null) ?? null;
}
