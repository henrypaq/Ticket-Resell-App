import { hasCompletedBetaSignup } from "@/domains/beta-signup/actions";
import { demoLoginEnabled } from "@/lib/env";
import { WaitlistFlow } from "@/components/beta-waitlist/waitlist-flow";
import { BetaWelcomeScreen } from "@/components/beta-waitlist/beta-welcome-screen";

export const dynamic = "force-dynamic";

/**
 * The public beta waitlist — deliberately outside the `(app)` route group, so
 * it never runs through requireSessionUser() or picks up the authenticated
 * shell's chrome (BottomNav, scan button). `/` shows this to every visitor
 * during the beta, session or no session; the real app now lives at `/home`.
 *
 * Acquisition first-touch (`?src=` / bare → `ig_bio`) is stamped in `proxy.ts`
 * — see `lib/beta-acquisition.ts`.
 */
export default async function WaitlistPage() {
  if (await hasCompletedBetaSignup()) {
    return <BetaWelcomeScreen showDevReset={demoLoginEnabled()} />;
  }
  return <WaitlistFlow showDevSkip={demoLoginEnabled()} />;
}
