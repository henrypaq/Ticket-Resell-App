"use client";

import { useState } from "react";
import { BottomSheet } from "./bottom-sheet";
import { logShareAction } from "@/domains/events/actions";
import { CheckIcon, LinkIcon, MailIcon, MessageIcon, WhatsAppIcon } from "./icons";

/**
 * White, deliberately breaking from the dark-first app theme — a share sheet
 * reads as a system-level surface, and the contrast makes it unmistakably a
 * different kind of moment than the rest of the UI (per request).
 */
export function ShareSheet({
  open,
  onClose,
  eventId,
  listingId,
  url,
  title,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  listingId?: string;
  url: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = encodeURIComponent(`${title} — ${url}`);

  function log(channel: string) {
    logShareAction(eventId, channel, listingId).catch(() => {
      // Analytics must never block the actual share — fire and forget.
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      log("copy_link");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permission denied or unsupported — nothing more to do here.
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} tone="light" title="Share this event">
      <div className="space-y-1">
        <ShareRow icon={LinkIcon} label={copied ? "Copied" : "Copy link"} onClick={copyLink}>
          {copied && <CheckIcon className="h-4 w-4 text-neutral-400" />}
        </ShareRow>

        <ShareRow
          icon={MessageIcon}
          label="Message"
          href={`sms:?&body=${text}`}
          onNavigate={() => log("sms")}
        />

        <ShareRow
          icon={WhatsAppIcon}
          label="WhatsApp"
          href={`https://wa.me/?text=${text}`}
          external
          onNavigate={() => log("whatsapp")}
        />

        <ShareRow
          icon={MailIcon}
          label="Email"
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${text}`}
          onNavigate={() => log("email")}
        />
      </div>
    </BottomSheet>
  );
}

function ShareRow({
  icon: Icon,
  label,
  onClick,
  href,
  external,
  onNavigate,
  children,
}: {
  icon: (props: { className?: string }) => React.ReactElement;
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  onNavigate?: () => void;
  children?: React.ReactNode;
}) {
  const content = (
    <>
      <span className="flex items-center gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100">
          <Icon className="h-5 w-5 text-neutral-700" />
        </span>
        <span className="text-[15px] font-medium text-neutral-900">{label}</span>
      </span>
      {children}
    </>
  );

  const className =
    "flex w-full items-center justify-between rounded-2xl px-2 py-2.5 text-left transition-colors active:bg-neutral-100";

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
        onClick={onNavigate}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
