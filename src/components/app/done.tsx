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
}: {
  intent: "buy" | "sell";
  /** Null when they already have a profile, or when there's nothing to build on. */
  prefill: ProfilePrefillData | null;
  hasProfile: boolean;
}) {
  const headline = intent === "buy" ? "You're on the waitlist" : "Ticket listing received";
  const sub =
    intent === "buy"
      ? "We'll message you when a ticket opens up."
      : "We'll review your ticket and reach out when there's a buyer.";

  return (
    <AppFlowShell>
      <div className="flex flex-1 flex-col">
        <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-6 text-[30px] leading-tight">{headline}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{sub}</p>

        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          {intent === "buy"
            ? "Your spot in line is on your home page — tap it any time to change how many tickets you need or how we reach you."
            : "Your listing is on your home page — you can remove it from there until it sells."}
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

        <Link href="/" className={`${BUTTON_CLASS} mt-8 w-full`}>
          Back to home
        </Link>

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
