/**
 * Thin, consistent-stroke outline icons (STYLE.md § iconography).
 * Filled variants exist only to mark an active nav state.
 */
type IconProps = { className?: string; filled?: boolean };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function SparkleIcon({ className, filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? "currentColor" : "none"}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </svg>
  );
}

export function CalendarIcon({ className, filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? "currentColor" : "none"}>
      <rect x="3" y="5" width="18" height="16" rx="3" fill={filled ? "currentColor" : "none"} />
      <path d="M8 3v4M16 3v4M3 10h18" stroke={filled ? "var(--color-base)" : "currentColor"} />
    </svg>
  );
}

export function TicketIcon({ className, filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? "currentColor" : "none"}>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5V8z" />
      <path d="M14 6v12" strokeDasharray="2 2.5" stroke={filled ? "var(--color-base)" : "currentColor"} />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function BellIcon({ className, filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? "currentColor" : "none"}>
      <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6z" />
      <path
        d="M10.3 20a2 2 0 0 0 3.4 0"
        stroke={filled ? "var(--color-base)" : "currentColor"}
      />
    </svg>
  );
}

export function HeartIcon({ className, filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20z" />
    </svg>
  );
}

export function NoteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.4" />
      <circle cx="17" cy="16" r="2.4" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 3l7 3v5.5c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V6l7-3z" />
      <path d="M9.2 12.2l2 2 3.6-3.8" />
    </svg>
  );
}

export function ChevronRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M9.5 5.5L16 12l-6.5 6.5" />
    </svg>
  );
}

export function ArrowLeft({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M14.5 5.5L8 12l6.5 6.5" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M9.5 14.5l5-5" />
      <path d="M11 7l1.3-1.3a3.5 3.5 0 0 1 5 5L16 12" />
      <path d="M13 17l-1.3 1.3a3.5 3.5 0 0 1-5-5L8 12" />
    </svg>
  );
}

export function MessageIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4.5 3.5V17a2 2 0 0 1-.5-1.3V6z" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4.5 19.5l1.2-4A7.8 7.8 0 1 1 8.9 18l-4.4 1.5z" />
      <path d="M8.7 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4 0 .6.5s.7 1.7.7 1.8.1.3 0 .5-.2.3-.4.5-.4.4-.2.7c.2.3.8 1.3 1.7 2.1s1.5.9 1.8 1c.3.1.5.1.7-.1s.7-.7.9-1 .4-.2.7-.1 1.7.8 2 .9.5.2.5.4-.1 1.1-.5 1.5-1.2 1-2.2.8c-1-.2-2.9-1.1-3.9-2.1s-1.9-2.5-2.1-3.4-.1-1.6.2-2.1z" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7l7 5.5L18.5 7" />
    </svg>
  );
}

export function MapPinFillIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
      <path d="M12 22s7.5-6.1 7.5-12A7.5 7.5 0 1 0 4.5 10c0 5.9 7.5 12 7.5 12z" />
      <circle cx="12" cy="10" r="2.7" fill="var(--color-base)" />
    </svg>
  );
}

/**
 * Instagram/Snapchat render as filled brand cutouts (no circular badge) —
 * recognizable logo glyphs in real brand colors, a deliberate exception to
 * the outline-icon system above.
 */
export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <radialGradient id="ig-cutout-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <path
        fill="url(#ig-cutout-grad)"
        fillRule="evenodd"
        d="
          M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zm5 2.75a4.25 4.25 0 1 1 0 8.5 4.25 4.25 0 0 1 0-8.5zm0 2a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5zM16.75 6.5a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z
        "
      />
    </svg>
  );
}

export function SnapchatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {/* Classic Snapchat ghost: yellow fill, black outline, simple face */}
      <path
        fill="#FFFC00"
        stroke="#0B0B0C"
        strokeWidth="1.35"
        strokeLinejoin="round"
        d="M12.02 2.55c2.85 0 5.15 2.05 5.15 5.25v.92c0 .28.07.68.68 1.02.72.4 1.45.98 1.45 2.05 0 .72-.5 1.28-1.35 1.55-.38.12-.62.4-.62.72 0 .52.4.98 1.02 1.3.52.28 1.12.68 1.12 1.32 0 .52-.45.92-1.15.92-.4 0-.8-.1-1.18-.32-.35-.2-.72-.22-1.05 0-1.08.68-2.45 1.08-3.97 1.08s-2.89-.4-3.97-1.08c-.33-.22-.7-.2-1.05 0-.38.22-.78.32-1.18.32-.7 0-1.15-.4-1.15-.92 0-.64.6-1.04 1.12-1.32.62-.32 1.02-.78 1.02-1.3 0-.32-.24-.6-.62-.72-.85-.27-1.35-.83-1.35-1.55 0-1.07.73-1.65 1.45-2.05.61-.34.68-.74.68-1.02v-.92c0-3.2 2.3-5.25 5.15-5.25z"
      />
      <circle cx="9.55" cy="9.35" r="1.05" fill="#0B0B0C" />
      <circle cx="14.45" cy="9.35" r="1.05" fill="#0B0B0C" />
      <path
        d="M9.6 12.15c.85 1.05 1.85 1.55 2.42 1.55s1.57-.5 2.42-1.55"
        fill="none"
        stroke="#0B0B0C"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HelpIcon({ className, filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? "currentColor" : "none"}>
      <circle cx="12" cy="12" r="8.5" />
      <path
        d="M9.8 9.4a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.2.9-1.2 1.8"
        stroke={filled ? "var(--color-base)" : "currentColor"}
      />
      <circle
        cx="12"
        cy="16.2"
        r="0.9"
        fill={filled ? "var(--color-base)" : "currentColor"}
        stroke="none"
      />
    </svg>
  );
}
