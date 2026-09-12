import { describe, expect, it } from "vitest";
import {
  betaEventBySlug,
  isPastNightlife,
  nightlifeDateKey,
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
});
