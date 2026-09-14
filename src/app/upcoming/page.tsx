import type { Metadata } from "next";
import { initialsFromName } from "@/components/app/header";
import { AppShell } from "@/components/app/shell";
import { AppUpcoming } from "@/components/app/upcoming";
import { loadBetaProfile } from "@/domains/beta-signup/actions";

export const metadata: Metadata = {
  title: "Upcoming events · mcgill.tickets",
  description: "Every Montreal night we support — pick one to buy or sell a ticket.",
};

export const dynamic = "force-dynamic";

/** The "See all" destination from home — the whole board, one section per night. */
export default async function UpcomingPage() {
  const profile = await loadBetaProfile();
  return (
    <AppShell initials={initialsFromName(profile?.name)}>
      <AppUpcoming />
    </AppShell>
  );
}
