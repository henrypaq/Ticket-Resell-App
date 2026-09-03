import { formatCad } from "@/lib/compliance/pricing";

export { formatCad };

const MONTREAL_TZ = "America/Montreal";

export function eventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: MONTREAL_TZ,
  });
}

export function dayBadge(iso: string): { weekday: string; day: string } {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString("en-CA", { weekday: "short", timeZone: MONTREAL_TZ }),
    day: d.toLocaleDateString("en-CA", { day: "numeric", timeZone: MONTREAL_TZ }),
  };
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: MONTREAL_TZ,
  });
}

export function dayGroupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return d.toLocaleDateString("en-CA", { weekday: "long", timeZone: MONTREAL_TZ });
  return d.toLocaleDateString("en-CA", { month: "long", day: "numeric", timeZone: MONTREAL_TZ });
}

/**
 * Countdown for the list-row metadata line. Returns null unless the event is
 * close enough to be genuinely time-pressured — STYLE.md restricts the amber
 * urgency accent to exactly this, so it has to stay rare to keep working.
 */
export function urgencyCountdown(iso: string): string | null {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0 || ms > 24 * 3_600_000) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}
