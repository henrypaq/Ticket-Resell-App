import { describe, expect, it } from "vitest";

import { doorsAtForEvent, doorsHourForEvent, montrealInstant } from "./doors";
import { DEFAULT_DOORS_HOUR } from "@/lib/beta-events";

const HOUR = 60 * 60 * 1000;

describe("montrealInstant", () => {
  it("resolves a summer evening through EDT (UTC-4)", () => {
    // 22:00 Saturday 2026-09-12 in Montreal is 02:00 UTC on the 13th.
    expect(montrealInstant("2026-09-12", 22).toISOString()).toBe("2026-09-13T02:00:00.000Z");
  });

  it("resolves a winter evening through EST (UTC-5)", () => {
    expect(montrealInstant("2026-01-17", 22).toISOString()).toBe("2026-01-18T03:00:00.000Z");
  });

  it("uses the offset in force on the night itself, not today's", () => {
    // The Saturday before the 2026-03-08 spring-forward is still EST.
    expect(montrealInstant("2026-03-07", 22).toISOString()).toBe("2026-03-08T03:00:00.000Z");
    // The Saturday after the 2026-11-01 fall-back is EST again.
    expect(montrealInstant("2026-11-07", 22).toISOString()).toBe("2026-11-08T03:00:00.000Z");
  });

  it("resolves an afternoon hour as well as a late-night one", () => {
    expect(montrealInstant("2026-09-13", 14).toISOString()).toBe("2026-09-13T18:00:00.000Z");
  });

  it("returns an invalid date for a malformed key rather than guessing", () => {
    expect(Number.isNaN(montrealInstant("not-a-date", 22).getTime())).toBe(true);
  });
});

describe("doorsHourForEvent", () => {
  it("defaults to the club-night hour", () => {
    expect(doorsHourForEvent("cafe-campus")).toBe(DEFAULT_DOORS_HOUR);
  });

  it("honours a daytime override", () => {
    expect(doorsHourForEvent("piknik-electronik")).toBe(14);
  });

  it("falls back to the default for an unknown slug", () => {
    expect(doorsHourForEvent("nope")).toBe(DEFAULT_DOORS_HOUR);
  });
});

describe("doorsAtForEvent", () => {
  it("picks tonight for a multi-night event on one of its nights", () => {
    // Saturday 2026-09-12, 18:00 Montreal. Café Campus runs Tue–Sat, so
    // earlier weeknights are behind us and tonight is the answer.
    const now = new Date("2026-09-12T22:00:00.000Z");
    expect(doorsAtForEvent("cafe-campus", now)?.toISOString()).toBe("2026-09-13T02:00:00.000Z");
  });

  it("picks tonight on a Tuesday café night", () => {
    const now = new Date("2026-09-15T18:00:00.000Z");
    expect(doorsAtForEvent("cafe-campus", now)?.toISOString()).toBe("2026-09-16T02:00:00.000Z");
  });

  it("picks the nearest upcoming night, not the first one listed", () => {
    // Friday 2026-09-11, 18:00 Montreal: earlier café nights are past, Friday is tonight.
    const now = new Date("2026-09-11T22:00:00.000Z");
    expect(doorsAtForEvent("cafe-campus", now)?.toISOString()).toBe("2026-09-12T02:00:00.000Z");
  });

  it("keeps a Saturday event on Saturday at 2am Sunday", () => {
    // The nightlife day runs to 6am, so 02:00 Sunday is still Saturday night.
    // Doors are behind us by then, which is exactly what should push matching
    // into its open regime rather than rolling forward a week.
    const now = new Date("2026-09-13T06:00:00.000Z"); // 02:00 Montreal, Sunday
    const doors = doorsAtForEvent("cafe-campus", now);
    expect(doors?.toISOString()).toBe("2026-09-13T02:00:00.000Z");
    expect(doors!.getTime()).toBeLessThan(now.getTime());
  });

  it("returns null for an unscheduled one-off with no nights", () => {
    const now = new Date("2026-09-12T22:00:00.000Z");
    expect(doorsAtForEvent("piknik-electronik", now)).toBeNull();
  });

  it("returns null for an interest-only option with no scheduled nights", () => {
    expect(doorsAtForEvent("stereo", new Date("2026-09-12T22:00:00.000Z"))).toBeNull();
  });

  it("returns null for an unknown slug", () => {
    expect(doorsAtForEvent("nope", new Date("2026-09-12T22:00:00.000Z"))).toBeNull();
  });

  it("rolls forward rather than returning a time days in the past", () => {
    // Sunday afternoon: every Café Campus night in this cycle is behind us.
    // A doors time in the past would read as "inside the open window".
    const now = new Date("2026-09-13T18:00:00.000Z"); // Sunday 14:00 Montreal
    const doors = doorsAtForEvent("cafe-campus", now);
    expect(doors).not.toBeNull();
    expect(doors!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("always lands on the configured local hour, whatever the offset", () => {
    const now = new Date("2026-09-12T22:00:00.000Z");
    const doors = doorsAtForEvent("cafe-campus", now)!;
    const localHour = Number(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(doors),
    );
    expect(localHour).toBe(DEFAULT_DOORS_HOUR);
  });

  it("produces a doors time matching policy expectations an hour before the event", () => {
    // Sanity-check the seam the policy depends on: one hour before doors must
    // be inside the open window, six hours before must not be.
    const now = new Date("2026-09-12T22:00:00.000Z");
    const doors = doorsAtForEvent("cafe-campus", now)!;
    expect(doors.getTime() - now.getTime()).toBe(4 * HOUR);
  });
});
