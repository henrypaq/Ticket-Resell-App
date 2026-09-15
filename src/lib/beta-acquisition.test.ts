import { describe, expect, it } from "vitest";
import {
  buildCampaignLink,
  formatAcquisitionSource,
  parseLastSrc,
} from "./beta-acquisition";

describe("formatAcquisitionSource", () => {
  it("labels known channels", () => {
    expect(formatAcquisitionSource("ig_bio")).toBe("Instagram bio");
    expect(formatAcquisitionSource("cafe_soldout")).toBe("Flyer · sold out");
  });

  it("spaces free-form campaign tags", () => {
    expect(formatAcquisitionSource("ig_story_cafe_0914")).toBe("ig story cafe 0914");
  });

  it("handles empty", () => {
    expect(formatAcquisitionSource(null)).toBe("Untagged");
    expect(formatAcquisitionSource("(none)")).toBe("Untagged");
  });
});

describe("buildCampaignLink", () => {
  it("builds a buy deep link with event and src", () => {
    expect(
      buildCampaignLink({
        intent: "buy",
        eventSlug: "cafe-campus",
        src: "ig_story_cafe",
        origin: "https://mcgilltickets.party",
      }),
    ).toBe("https://mcgilltickets.party/buy?event=cafe-campus&src=ig_story_cafe");
  });

  it("builds a sell link without src", () => {
    expect(
      buildCampaignLink({
        intent: "sell",
        eventSlug: "piknik-electronik",
        origin: "https://mcgilltickets.party",
      }),
    ).toBe("https://mcgilltickets.party/sell?event=piknik-electronik");
  });

  it("drops invalid src tags", () => {
    expect(
      buildCampaignLink({
        intent: "buy",
        eventSlug: "cafe-campus",
        src: "BAD SRC!!",
        origin: "https://mcgilltickets.party",
      }),
    ).toBe("https://mcgilltickets.party/buy?event=cafe-campus");
  });

  it("builds a home landing with src only", () => {
    expect(
      buildCampaignLink({
        intent: "home",
        src: "qr_print",
        origin: "https://mcgilltickets.party",
      }),
    ).toBe("https://mcgilltickets.party/?src=qr_print");
  });
});

describe("parseLastSrc", () => {
  it("normalizes valid tags", () => {
    expect(parseLastSrc("IG_Story_Cafe")).toBe("ig_story_cafe");
  });
});
