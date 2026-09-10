"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetBetaSignupAction } from "@/domains/beta-signup/actions";
import type { BetaSignupProfile } from "@/domains/beta-signup/shared";
import { BETA_SOCIALS } from "@/lib/beta-events";
import {
  BellIcon,
  CalendarIcon,
  HelpIcon,
  InstagramIcon,
  SnapchatIcon,
} from "@/components/icons";
import { BetaEventsTab } from "./events-tab";
import { BetaNotisTab } from "./notis-tab";
import { BetaHelpTab } from "./help-tab";
import { Starfield } from "./starfield";

type Tab = "events" | "notis" | "help";

const TABS: { id: Tab; label: string; Icon: typeof CalendarIcon }[] = [
  { id: "events", label: "Events", Icon: CalendarIcon },
  { id: "notis", label: "Notis", Icon: BellIcon },
  { id: "help", label: "Contact", Icon: HelpIcon },
];

type Props = {
  profile: BetaSignupProfile | null;
  showDevReset?: boolean;
};

/**
 * Post-signup beta shell: brand + socials header, three tabs (Events / Notis /
 * Help), floating pill nav matching the authenticated app's chrome language.
 */
export function BetaShell({ profile, showDevReset = false }: Props) {
  const [tab, setTab] = useState<Tab>("events");
  const router = useRouter();
  const [resetPending, startReset] = useTransition();
  const [resetError, setResetError] = useState<string | null>(null);

  function onReset() {
    setResetError(null);
    startReset(async () => {
      const result = await resetBetaSignupAction();
      if (result.error) {
        setResetError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-32 sm:px-6">
      <Starfield />
      <Glow />

      {showDevReset && (
        <div className="relative mb-3 flex items-center justify-end gap-2">
          {resetError && <span className="text-[12px] text-urgency">{resetError}</span>}
          <button
            type="button"
            onClick={onReset}
            disabled={resetPending}
            className="text-[12px] font-semibold text-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-ink disabled:opacity-60"
          >
            {resetPending ? "Resetting…" : "Back to start (dev)"}
          </button>
        </div>
      )}

      <header className="relative flex items-center justify-between gap-3">
        <p className="text-[17px] font-semibold tracking-tight text-[#ffe500]">mcgill.tickets</p>
        <div className="flex items-center gap-2">
          <a
            href={BETA_SOCIALS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="transition-transform hover:scale-105"
          >
            <InstagramIcon className="h-9 w-9" />
          </a>
          <a
            href={BETA_SOCIALS.snapchat}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Snapchat"
            className="transition-transform hover:scale-105"
          >
            <SnapchatIcon className="h-9 w-9" />
          </a>
        </div>
      </header>

      <main className="relative mt-8 flex-1">
        {tab === "events" && <BetaEventsTab profile={profile} />}
        {tab === "notis" && <BetaNotisTab profile={profile} />}
        {tab === "help" && <BetaHelpTab profile={profile} />}
      </main>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto max-w-lg px-4">
          <div className="frosted flex items-center rounded-full border border-white/10 p-1.5">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-full px-3 py-2 transition-colors ${
                    active ? "bg-white/10 text-ink" : "text-muted"
                  }`}
                >
                  <Icon className="h-[22px] w-[22px]" filled={active} />
                  <span className={`text-[11px] ${active ? "font-semibold" : ""}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

function Glow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60"
      style={{
        background:
          "radial-gradient(60% 60% at 50% 0%, rgba(110,225,255,0.16) 0%, rgba(110,225,255,0.06) 45%, transparent 75%)",
      }}
    />
  );
}
