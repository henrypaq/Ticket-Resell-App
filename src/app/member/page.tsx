import { hasCompletedBetaSignup } from "@/domains/beta-signup/actions";
import { demoLoginEnabled } from "@/lib/env";
import { WaitlistFlow } from "@/components/beta-waitlist/waitlist-flow";
import { BetaWelcomeScreen } from "@/components/beta-waitlist/beta-welcome-screen";

export const dynamic = "force-dynamic";

/**
 * Beta member onboarding + hub — full profiles, alerts, multi-event waitlists.
 * Low-friction IG flow stays at `/go`. Apex `/` redirects here (QR-compatible).
 */
export default async function MemberPage() {
  if (await hasCompletedBetaSignup()) {
    return <BetaWelcomeScreen showDevReset={demoLoginEnabled()} />;
  }
  return <WaitlistFlow showDevSkip={demoLoginEnabled()} />;
}
