import { describe, expect, it } from "vitest";
import {
  groupOpsWaitlistByEventDate,
  partitionSellerLeads,
  partitionWaitlistEntries,
  type OpsWaitlistEntry,
} from "./shared";

describe("ops waitlist and sellers partitioning", () => {
  const saturdayNow = new Date("2026-09-12T15:00:00Z"); // Saturday morning/afternoon EDT

  it("partitions past Thursday/Friday entries into past waitlist", () => {
    const entries: OpsWaitlistEntry[] = [
      {
        id: "thursday-lead",
        source: "classic",
        name: "Thursday Joiner",
        email: "thursday@test.com",
        eventSlug: "cafe-campus",
        eventName: "Café Campus",
        eventDays: ["Thursday", "Friday", "Saturday"],
        quantity: 1,
        displayedPosition: 7,
        contactPhone: null,
        contactInstagram: "thursday",
        status: "classic",
        acquisitionChannel: null,
        adminNotes: null,
        createdAt: "2026-09-11T01:13:00Z", // Thursday night EDT
      },
      {
        id: "friday-lead",
        source: "go",
        name: "Friday Joiner",
        email: "friday@test.com",
        eventSlug: "cafe-campus",
        eventName: "Café Campus",
        eventDays: ["Thursday", "Friday", "Saturday"],
        quantity: 1,
        displayedPosition: 9,
        contactPhone: null,
        contactInstagram: "friday",
        status: "new",
        acquisitionChannel: null,
        adminNotes: null,
        createdAt: "2026-09-11T20:22:00Z", // Friday EDT
      },
      {
        id: "sunday-lead",
        source: "classic",
        name: "Sunday Joiner",
        email: "sunday@test.com",
        eventSlug: "piknik-electronik",
        eventName: "Piknik Électronik",
        eventDays: ["Sunday"],
        quantity: 1,
        displayedPosition: 3,
        contactPhone: null,
        contactInstagram: "sunday",
        status: "classic",
        acquisitionChannel: null,
        adminNotes: null,
        createdAt: "2026-09-11T01:13:00Z", // Created earlier, but Piknik is upcoming Sunday!
      },
      {
        id: "saturday-lead",
        source: "go",
        name: "Saturday Joiner",
        email: "sat@test.com",
        eventSlug: "cafe-campus",
        eventName: "Café Campus",
        eventDays: ["Thursday", "Friday", "Saturday"],
        quantity: 2,
        displayedPosition: 1,
        contactPhone: null,
        contactInstagram: "sat",
        status: "new",
        acquisitionChannel: null,
        adminNotes: null,
        createdAt: "2026-09-12T14:00:00Z", // Saturday EDT
      },
    ];

    const { active, past } = partitionWaitlistEntries(entries, saturdayNow);

    expect(past.map((e) => e.id)).toEqual(["thursday-lead", "friday-lead"]);
    expect(active.map((e) => e.id)).toEqual(["sunday-lead", "saturday-lead"]);
  });

  it("partitions seller leads into active vs past", () => {
    const leads = [
      { id: "1", createdAt: "2026-09-11T20:10:00Z" }, // Friday
      { id: "2", createdAt: "2026-09-12T14:00:00Z" }, // Saturday
    ];

    const { active, past } = partitionSellerLeads(leads, saturdayNow);
    expect(past.map((l) => l.id)).toEqual(["1"]);
    expect(active.map((l) => l.id)).toEqual(["2"]);
  });

  it("groups active waitlists by event date, removes past dates, and sorts first to last", () => {
    const activeEntries: OpsWaitlistEntry[] = [
      {
        id: "sat-cafe",
        source: "go",
        name: "Café Fan",
        email: "cafe@test.com",
        eventSlug: "cafe-campus",
        eventName: "Café Campus",
        eventDays: ["Thursday", "Friday", "Saturday"],
        quantity: 1,
        displayedPosition: 1,
        contactPhone: null,
        contactInstagram: null,
        status: "new",
        acquisitionChannel: null,
        adminNotes: null,
        createdAt: "2026-09-12T14:00:00Z",
      },
      {
        id: "sun-piknik",
        source: "classic",
        name: "Piknik Fan",
        email: "piknik@test.com",
        eventSlug: "piknik-electronik",
        eventName: "Piknik Électronik",
        eventDays: ["Sunday"],
        quantity: 1,
        displayedPosition: 1,
        contactPhone: null,
        contactInstagram: null,
        status: "classic",
        acquisitionChannel: null,
        adminNotes: null,
        createdAt: "2026-09-11T10:00:00Z",
      },
      {
        id: "stereo-interest",
        source: "classic",
        name: "Stereo Fan",
        email: "stereo@test.com",
        eventSlug: "stereo",
        eventName: "stereo",
        eventDays: [],
        quantity: 1,
        displayedPosition: 1,
        contactPhone: null,
        contactInstagram: null,
        status: "classic",
        acquisitionChannel: null,
        adminNotes: null,
        createdAt: "2026-09-11T10:00:00Z",
      },
    ];

    const groups = groupOpsWaitlistByEventDate(activeEntries, saturdayNow);

    // Should NOT contain Thursday or Friday groups
    expect(groups.some((g) => g.key.includes("Thursday"))).toBe(false);
    expect(groups.some((g) => g.key.includes("Friday"))).toBe(false);

    // First group should be tonight (Saturday Sep 12)
    const satGroup = groups.find((g) => g.eventSlug === "cafe-campus");
    expect(satGroup).toBeDefined();
    expect(satGroup?.isTonight).toBe(true);
    expect(satGroup?.dateKey).toBe("2026-09-12");

    // Sunday Piknik should be next
    const sunGroup = groups.find((g) => g.eventSlug === "piknik-electronik");
    expect(sunGroup).toBeDefined();
    expect(sunGroup?.dateKey).toBe("2026-09-13");

    // Chronological order: Saturday before Sunday before interest-only
    const keys = groups.map((g) => g.dateKey);
    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i]! <= keys[i + 1]!).toBe(true);
    }
  });
});
