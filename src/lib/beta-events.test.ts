import { describe, expect, it } from "vitest";
import {
  betaEventBySlug,
  eventDayDateKey,
  goSelectableEvents,
  groupEventsByUpcomingDays,
  isPastNightlife,
  nightlifeDateKey,
  tonightEventOptions,
  type BetaEvent,
} from "./beta-events";

describe("beta-events and nightlife date calculations", () => {
  it("removes entryNote from cafe-campus", () => {
    const cafe = betaEventBySlug("cafe-campus");
    expect(cafe?.entryNote).toBeUndefined();
  });

  it("schedules Café Campus Tue–Sat and leaves one-offs unscheduled", () => {
    const cafe = betaEventBySlug("cafe-campus");
    expect(cafe?.days).toEqual(["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
    expect(betaEventBySlug("montreal-frosh-muzique")?.days).toEqual([]);
    expect(betaEventBySlug("niska-bell-center")?.days).toEqual([]);
    expect(betaEventBySlug("piknik-electronik")?.days).toEqual([]);
  });

  it("keeps late night before 6am attached to previous night", () => {
    // 2026-09-12 02:30:00 EDT (UTC-4) -> UTC is 2026-09-12 06:30:00Z
    const lateNightFriday = new Date("2026-09-12T06:30:00Z");
    expect(nightlifeDateKey(lateNightFriday)).toBe("2026-09-11");
  });

  it("advances nightlife date at 6am Montreal time", () => {
    // 2026-09-12 06:05:00 EDT (UTC-4) -> UTC is 2026-09-12 10:05:00Z
    const morningSaturday = new Date("2026-09-12T10:05:00Z");
    expect(nightlifeDateKey(morningSaturday)).toBe("2026-09-12");
  });

  it("identifies listings from last night as past", () => {
    // Listing created on Friday Sep 11 at 4:14 PM EDT (20:14 UTC)
    const listingFriday = "2026-09-11T20:14:53.372Z";
    // Now is Saturday Sep 12 at 11:48 AM EDT (15:48 UTC)
    const nowSaturday = new Date("2026-09-12T15:48:00Z");
    expect(isPastNightlife(listingFriday, nowSaturday)).toBe(true);
  });

  it("keeps listings from today's nightlife date as active", () => {
    // Listing created on Saturday Sep 12 at 10:00 AM EDT (14:00 UTC)
    const listingSaturday = "2026-09-12T14:00:00Z";
    const nowSaturday = new Date("2026-09-12T15:48:00Z");
    expect(isPastNightlife(listingSaturday, nowSaturday)).toBe(false);
  });

  it("calculates past vs active event day schedules relative to Saturday Sep 12", () => {
    const nowSaturday = new Date("2026-09-12T15:48:00Z");
    const thursday = eventDayDateKey("Thursday", nowSaturday);
    expect(thursday.isPast).toBe(true);
    expect(thursday.isTonight).toBe(false);
    expect(thursday.dateKey).toBe("2026-09-10");

    const friday = eventDayDateKey("Friday", nowSaturday);
    expect(friday.isPast).toBe(true);
    expect(friday.isTonight).toBe(false);
    expect(friday.dateKey).toBe("2026-09-11");

    const saturday = eventDayDateKey("Saturday", nowSaturday);
    expect(saturday.isPast).toBe(false);
    expect(saturday.isTonight).toBe(true);
    expect(saturday.dateKey).toBe("2026-09-12");

    const sunday = eventDayDateKey("Sunday", nowSaturday);
    expect(sunday.isPast).toBe(false);
    expect(sunday.isTonight).toBe(false);
    expect(sunday.dateKey).toBe("2026-09-13");
  });

  it("limits goSelectableEvents to Café Campus on a recurring café night", () => {
    // Saturday Sep 12: only Café Campus runs (one-offs have empty days).
    const nowSaturday = new Date("2026-09-12T15:48:00Z");
    const selectable = goSelectableEvents(nowSaturday);
    expect(selectable.map((e) => e.slug)).toEqual(["cafe-campus"]);
  });

  it("does not fall forward to later nights when tonight is empty", () => {
    // Monday Sep 14 — Café Campus does not run Mondays.
    const nowMonday = new Date("2026-09-14T18:00:00Z");
    expect(goSelectableEvents(nowMonday)).toEqual([]);
    expect(tonightEventOptions(nowMonday)).toEqual([]);
  });

  it("lists Café Campus on recurring Tuesdays without a one-off date", () => {
    const tuesday = new Date("2026-09-15T18:00:00Z");
    expect(goSelectableEvents(tuesday).map((e) => e.slug)).toEqual(["cafe-campus"]);
    const nextTuesday = new Date("2026-09-22T18:00:00Z");
    expect(goSelectableEvents(nextTuesday).map((e) => e.slug)).toEqual(["cafe-campus"]);
  });

  it("does not recycle unscheduled one-offs onto later weeks", () => {
    const nowSaturday = new Date("2026-09-12T15:48:00Z");
    const options = tonightEventOptions(nowSaturday);
    expect(options.map((o) => o.slug)).toEqual(["cafe-campus"]);
    expect(options.map((o) => o.slug)).not.toContain("niska-bell-center");
    expect(options.map((o) => o.slug)).not.toContain("montreal-frosh-muzique");
    expect(options.map((o) => o.slug)).not.toContain("piknik-electronik");
  });

  it("surfaces manually scheduled extraDateKeys under that night only", () => {
    // Monday 2026-09-14 — no recurring café night; a one-off must be explicit.
    const monday = new Date("2026-09-14T18:00:00Z");
    const oneOff: BetaEvent = {
      slug: "test-one-off",
      name: "Test One-Off",
      venue: "Test",
      city: "Montreal",
      blurb: "fixture",
      flyerUrl: "/flyers/cafe-campus.jpg",
      days: [],
      extraDateKeys: ["2026-09-14"],
      supported: true,
    };
    const grouped = groupEventsByUpcomingDays([oneOff], monday);
    expect(grouped[0]?.[0]).toBe("Monday");
    expect(grouped[0]?.[1].map((e) => e.slug)).toEqual(["test-one-off"]);
    expect(
      grouped.some(
        ([day, events]) => day !== "Monday" && events.some((e) => e.slug === "test-one-off"),
      ),
    ).toBe(false);
  });
});
