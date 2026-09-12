import { describe, expect, it } from "vitest";
import {
  betaEventBySlug,
  eventDayDateKey,
  goSelectableEvents,
  isPastNightlife,
  nightlifeDateKey,
  tonightEventOptions,
} from "./beta-events";

describe("beta-events and nightlife date calculations", () => {
  it("removes entryNote from cafe-campus", () => {
    const cafe = betaEventBySlug("cafe-campus");
    expect(cafe?.entryNote).toBeUndefined();
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

  it("limits goSelectableEvents to ONLY the events available for the given night", () => {
    // Saturday Sep 12: only Café Campus and Niska @ Bell Center run tonight
    const nowSaturday = new Date("2026-09-12T15:48:00Z");
    const selectable = goSelectableEvents(nowSaturday);
    const slugs = selectable.map((e) => e.slug);

    expect(slugs).toContain("cafe-campus");
    expect(slugs).toContain("niska-bell-center");
    // Piknik is Sunday only, Muzique is Thursday only -> must NOT show on Saturday
    expect(slugs).not.toContain("piknik-electronik");
    expect(slugs).not.toContain("montreal-frosh-muzique");
    expect(selectable.length).toBe(2);
  });

  it("limits tonightEventOptions to ONLY the events available for the given night", () => {
    const nowSaturday = new Date("2026-09-12T15:48:00Z");
    const options = tonightEventOptions(nowSaturday);
    const slugs = options.map((o) => o.slug);

    expect(slugs).toEqual(["cafe-campus", "niska-bell-center"]);
    expect(slugs).not.toContain("piknik-electronik");
    expect(slugs).not.toContain("montreal-frosh-muzique");
  });
});


