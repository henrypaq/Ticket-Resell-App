import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinishAccountSetup } from "@/components/app/finish-account";
import { loadProfilePrefill, loadSavedGoContact } from "@/domains/beta-quick/actions";
import {
  ensureBetaProfileFromSession,
  loadBetaProfile,
} from "@/domains/beta-signup/actions";
import { safeReturnPath } from "@/lib/safe-return-path";

export const metadata: Metadata = {
  title: "Finish your account · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Optional post-flow account setup: profile + Interac payout, then return via
 * `?next=` to home, an offer claim, or wherever they came from.
 *
 * Google OAuth lands here after `/auth/callback`; we link the session to a
 * beta profile and continue with Interac if payout details are still missing.
 */
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; next?: string }>;
}) {
  const params = await searchParams;
  const intent = params.intent === "sell" ? "sell" : "buy";
  const returnTo = safeReturnPath(params.next, "/");

  let prefill = await loadProfilePrefill();

  await ensureBetaProfileFromSession({
    intent,
    eventName: prefill?.eventName,
    referralSource: prefill?.referralSource,
  });

  const profile = await loadBetaProfile();
  const contact = await loadSavedGoContact();
  const hasPayout = Boolean(
    (contact?.etransferEmail && contact.etransferEmail.length > 3) ||
      (contact?.etransferPhone && contact.etransferPhone.replace(/\D/g, "").length >= 7),
  );

  if (profile && hasPayout) {
    redirect(returnTo);
  }

  if (!prefill) {
    if (!profile) redirect(returnTo);
    prefill = {
      name: profile.name,
      email: profile.email,
      phone: profile.phone || contact?.contactPhone || null,
      intent,
      eventName: null,
      referralSource: null,
      contactInstagram: contact?.contactInstagram ?? null,
      etransferName: contact?.etransferName ?? profile.name,
      etransferEmail: contact?.etransferEmail ?? null,
      etransferPhone: contact?.etransferPhone ?? null,
    };
  } else if (profile) {
    prefill = {
      ...prefill,
      name: profile.name || prefill.name,
      email: profile.email || prefill.email,
      phone: profile.phone || prefill.phone,
      etransferName: contact?.etransferName ?? prefill.etransferName ?? profile.name,
      etransferEmail: contact?.etransferEmail ?? prefill.etransferEmail,
      etransferPhone: contact?.etransferPhone ?? prefill.etransferPhone,
      contactInstagram: contact?.contactInstagram ?? prefill.contactInstagram,
    };
  }

  const mode = profile ? "payout" : "full";
  const setupResumePath = `/setup?intent=${intent}&next=${encodeURIComponent(returnTo)}`;

  return (
    <FinishAccountSetup
      prefill={prefill}
      intent={intent}
      returnTo={returnTo}
      mode={mode}
      googleNextPath={setupResumePath}
    />
  );
}
