import Link from "next/link";
import type { ProfilePrefillData } from "@/domains/beta-quick/shared";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import { SaveProfileCard } from "./save-profile";
import { AppFlowShell } from "./shell";

/**
 * Terminal screen for both flows, and the only place the app asks anyone to
 * create a profile. Nothing is gated on having one: the contact cookie
 * already carries this device, so the pitch is portability and alerts, not
 * access.
 */
export function DoneScreen({
  intent,
  prefill,
  hasProfile,
  offerId,
}: {
  intent: "buy" | "sell";
  /** Null when they already have a profile, or when there's nothing to build on. */
  prefill: ProfilePrefillData | null;
  hasProfile: boolean;
  /** When set, a ticket is already held — jump to pay. */
  offerId?: string | null;
}) {
  if (intent === "sell") {
    return (
      <AppFlowShell>
        <SellConfirmation />
      </AppFlowShell>
    );
  }

  const headline = offerId ? "A ticket is ready for you" : "You're on the waitlist";
  const sub = offerId
    ? "It's held only for you — claim it and send Interac now."
    : "When a ticket is held for you, we'll message you with a short claim window.";

  return (
    <AppFlowShell>
      <div className="flex flex-1 flex-col">
        <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-6 text-[30px] leading-tight">{headline}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{sub}</p>

        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          {offerId
            ? "Nobody else can take this ticket while your hold is live."
            : "Your spot is on your home page — change quantity or contact anytime."}
        </p>

        {prefill && (
          <div className="mt-8">
            <SaveProfileCard
              prefill={{
                name: prefill.name,
                email: prefill.email,
                phone: prefill.phone,
                intent: prefill.intent ?? intent,
                eventName: prefill.eventName,
                referralSource: prefill.referralSource,
              }}
            />
          </div>
        )}

        {offerId ? (
          <Link href={`/offer/${offerId}`} className={`${BUTTON_CLASS} mt-8 w-full`}>
            Claim &amp; pay
          </Link>
        ) : (
          <Link href="/" className={`${BUTTON_CLASS} mt-8 w-full`}>
            Back to home
          </Link>
        )}

        {hasProfile && (
          <p className="mt-4 text-center text-[13px] text-muted">
            Alerts go out fast when a match comes up —{" "}
            <Link
              href="/settings"
              className="font-semibold text-ink underline decoration-dotted underline-offset-4"
            >
              check how we reach you
            </Link>
            .
          </p>
        )}
      </div>
    </AppFlowShell>
  );
}

/** Shared sell success — also rendered inline so submit doesn't wait on a second page load. */
export function SellConfirmation() {
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
      <h1 className="headline mt-8 text-[32px] leading-[1.12] tracking-tight">
        You&apos;re all set
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        Your ticket is listed. We match one buyer at a time — they pay us by Interac, then we pay
        you the same way. We emailed a confirmation and will notify you when it sells.
      </p>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Your listing is on your home page until it sells or you remove it.
      </p>
      <Link href="/" className={`${BUTTON_CLASS} mt-10 w-full`}>
        Go back home
      </Link>
    </div>
  );
}
