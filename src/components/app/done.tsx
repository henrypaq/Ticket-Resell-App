import Link from "next/link";
import type { ProfilePrefillData } from "@/domains/beta-quick/shared";
import { BUTTON_CLASS } from "@/components/forms/field-styles";
import { SECONDARY_BUTTON_CLASS } from "./event-pieces";
import { AppFlowShell } from "./shell";
import { GoogleContinueButton } from "./google-continue-button";
import { CafeCampusTransferCard } from "./cafe-campus-transfer-card";

function setupHref(intent: "buy" | "sell", returnTo: string): string {
  const params = new URLSearchParams({ intent, next: returnTo });
  return `/setup?${params.toString()}`;
}

/**
 * Terminal screen for both flows, and the entry point into optional account
 * setup. Nothing is gated on having a profile: the contact cookie already
 * carries this device, so the pitch is portability and alerts, not access.
 */
export function DoneScreen({
  intent,
  prefill,
  hasProfile,
  offerId,
  cafeTransfer,
  sellLeadId,
  sellerTicketSentAt,
}: {
  intent: "buy" | "sell";
  /** Null when they already have a profile, or when there's nothing to build on. */
  prefill: ProfilePrefillData | null;
  hasProfile: boolean;
  /** When set, a ticket is already held — jump to pay. */
  offerId?: string | null;
  /** Café Campus custody destination when this was a café sell. */
  cafeTransfer?: { name: string; email: string } | null;
  sellLeadId?: string | null;
  sellerTicketSentAt?: string | null;
}) {
  if (intent === "sell") {
    return (
      <AppFlowShell>
        <SellConfirmation
          showSetup={!hasProfile && Boolean(prefill)}
          cafeTransfer={cafeTransfer ?? undefined}
          sellLeadId={sellLeadId}
          sellerTicketSentAt={sellerTicketSentAt}
        />
      </AppFlowShell>
    );
  }

  const returnTo = offerId ? `/offer/${offerId}` : "/";
  const setupPath = setupHref("buy", returnTo);
  const headline = offerId ? "A ticket is ready for you" : "You're on the waitlist";
  const sub = offerId
    ? "This ticket is held exclusively for you. Claim it and send Interac payment to complete the purchase."
    : "When a ticket is held for you, we will notify you with a short claim window.";

  return (
    <AppFlowShell>
      <div className="flex flex-1 flex-col">
        <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-6 text-[30px] leading-tight">{headline}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{sub}</p>

        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          {offerId
            ? "No other buyer can take this ticket while your hold is active."
            : "Your place in line is on your home page. You can update quantity or contact details anytime."}
        </p>

        {offerId ? (
          <Link href={`/offer/${offerId}`} className={`${BUTTON_CLASS} mt-8 w-full`}>
            Claim &amp; pay
          </Link>
        ) : (
          <Link href="/" className={`${BUTTON_CLASS} mt-8 w-full`}>
            Back to home
          </Link>
        )}

        {!hasProfile && prefill && (
          <section className="mt-10 border-t border-white/10 pt-8">
            <h2 className="text-[15px] font-semibold text-ink">Finish your account</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Optional — save your details so matches follow you across devices, and add Interac
              payout info for when you sell.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <GoogleContinueButton nextPath={setupPath} />
              <Link
                href={setupPath}
                className={`${SECONDARY_BUTTON_CLASS} min-h-[52px] w-full text-[15px]`}
              >
                Continue with email
              </Link>
            </div>
          </section>
        )}

        {hasProfile && (
          <p className="mt-6 text-center text-[13px] text-muted">
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
export function SellConfirmation({
  showSetup = false,
  cafeTransfer,
  sellLeadId,
  sellerTicketSentAt,
}: {
  showSetup?: boolean;
  cafeTransfer?: { name: string; email: string };
  sellLeadId?: string | null;
  sellerTicketSentAt?: string | null;
}) {
  const setupPath = setupHref("sell", "/");
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
      <h1 className="headline mt-8 text-[32px] leading-[1.12] tracking-tight">
        You&apos;re all set
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        Your ticket is listed. We match one buyer at a time: they pay us by Interac, then we pay you
        the same way. A confirmation email has been sent, and we will notify you when it sells.
      </p>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        Your listing remains on your home page until it sells or you remove it.
      </p>

      {cafeTransfer && (
        <div className="mt-8">
          <CafeCampusTransferCard
            name={cafeTransfer.name}
            email={cafeTransfer.email}
            sellLeadId={sellLeadId}
            alreadyDeclared={Boolean(sellerTicketSentAt)}
          />
        </div>
      )}

      <Link href="/" className={`${BUTTON_CLASS} mt-10 w-full`}>
        Go back home
      </Link>

      {showSetup && (
        <section className="mt-10 border-t border-white/10 pt-8">
          <h2 className="text-[15px] font-semibold text-ink">Finish your account</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Optional — save your details so listings follow you across devices.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <GoogleContinueButton nextPath={setupPath} />
            <Link
              href={setupPath}
              className={`${SECONDARY_BUTTON_CLASS} min-h-[52px] w-full text-[15px]`}
            >
              Continue with email
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
