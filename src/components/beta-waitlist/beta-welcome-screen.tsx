import { loadBetaProfile } from "@/domains/beta-signup/actions";
import { BetaShell } from "./beta-shell";

/**
 * Post-signup surface for the beta waitlist. Replaces the old static "you're
 * on the list" cards with the Events / Notis / Help shell that persists
 * communication prefs and event interest for later alert hooks.
 */
export async function BetaWelcomeScreen({ showDevReset = false }: { showDevReset?: boolean }) {
  const profile = await loadBetaProfile();
  return <BetaShell profile={profile} showDevReset={showDevReset} />;
}
