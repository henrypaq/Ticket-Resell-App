import type { Metadata } from "next";
import { initialsFromName } from "@/components/app/header";
import { AppSettings } from "@/components/app/settings";
import { AppShell } from "@/components/app/shell";
import { requireMember } from "@/domains/beta-signup/gate";
import { demoLoginEnabled } from "@/lib/env";

export const metadata: Metadata = {
  title: "Your account · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Behind the account button: personal info, communication settings, contact us. */
export default async function SettingsPage() {
  const profile = await requireMember();
  return (
    <AppShell initials={initialsFromName(profile.name)}>
      <AppSettings profile={profile} showDevReset={demoLoginEnabled()} />
    </AppShell>
  );
}
