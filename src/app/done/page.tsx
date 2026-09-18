import type { Metadata } from "next";
import { DoneScreen } from "@/components/app/done";
import { loadProfilePrefill } from "@/domains/beta-quick/actions";
import { loadBetaProfile } from "@/domains/beta-signup/actions";

export const metadata: Metadata = {
  title: "You're in · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Success screen, and the one place we ask for a profile. Someone who already
 * has one sees nothing extra; someone who arrived from a story link twenty
 * seconds ago gets a mostly-prefilled card.
 */
export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const params = await searchParams;
  const intent = params.intent === "sell" ? "sell" : "buy";

  // Sell confirmation is a fixed screen — skip profile fetches so the URL
  // swap after submit isn't another long wait.
  if (intent === "sell") {
    return <DoneScreen intent="sell" prefill={null} hasProfile={false} />;
  }

  const [profile, prefill] = await Promise.all([loadBetaProfile(), loadProfilePrefill()]);

  return (
    <DoneScreen
      intent={intent}
      prefill={profile ? null : prefill}
      hasProfile={Boolean(profile)}
    />
  );
}
