import type { Metadata } from "next";
import { initialsFromName } from "@/components/app/header";
import { AppSettings } from "@/components/app/settings";
import { AppShell } from "@/components/app/shell";
import { loadProfilePrefill } from "@/domains/beta-quick/actions";
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
  const profile = await loadBetaProfile();
  const prefill = profile ? null : await loadProfilePrefill();

  return (
    <AppShell initials={initialsFromName(profile?.name)}>
      <AppSettings profile={profile} prefill={prefill} showDevReset={demoLoginEnabled()} />
    </AppShell>
  );
}
