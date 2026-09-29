import type { Metadata } from "next";
import { initialsFromName } from "@/components/app/header";
import { AppSettings } from "@/components/app/settings";
import { AppShell } from "@/components/app/shell";
import {
  loadGoActivityForHub,
  loadProfilePrefill,
  loadQuickWaitlistForHub,
} from "@/domains/beta-quick/actions";
import { buyerJourney, sellerJourney } from "@/domains/beta-quick/journey";
import { loadBetaProfile } from "@/domains/beta-signup/actions";
import { demoLoginEnabled } from "@/lib/env";

export const metadata: Metadata = {
  title: "Your account · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Behind the account button. Reachable without a profile — someone who has
 * only ever used a flow can still contact us and can save a profile from
 * here, they just have nothing to edit yet.
 */
export default async function SettingsPage() {
  const [profile, waitlist, activity] = await Promise.all([
    loadBetaProfile(),
    loadQuickWaitlistForHub(),
    loadGoActivityForHub(),
  ]);
  const prefill = profile ? null : await loadProfilePrefill();

  // Finished business, off home but still worth finding: tickets the buyer
  // confirmed receiving, and sales whose payout is fully settled.
  const pastTickets = [
    ...waitlist
      .filter((e) => buyerJourney(e).stage === "received")
      .map((e) => ({
        key: e.leadId,
        kind: "bought" as const,
        eventName: e.eventName,
        detail: e.quantity === 1 ? "Bought · 1 ticket" : `Bought · ${e.quantity} tickets`,
        href: buyerJourney(e).href,
        at: e.buyerConfirmedReceivedAt ?? e.createdAt,
      })),
    ...activity
      .filter(
        (a) =>
          a.intent === "sell" &&
          sellerJourney(a).stage === "paid_out" &&
          !a.payoutToConfirmOfferId,
      )
      .map((a) => ({
        key: a.leadId,
        kind: "sold" as const,
        eventName: a.eventName,
        detail: `Sold · ×${a.soldCount || a.quantity}${
          a.askEach != null ? ` · $${a.askEach.toFixed(0)} each` : ""
        }`,
        href: `/listing/${a.leadId}`,
        at: a.createdAt,
      })),
  ].sort((x, y) => y.at.localeCompare(x.at));

  return (
    <AppShell initials={initialsFromName(profile?.name)}>
      <AppSettings
        profile={profile}
        prefill={prefill}
        pastTickets={pastTickets}
        showDevReset={demoLoginEnabled()}
      />
    </AppShell>
  );
}
