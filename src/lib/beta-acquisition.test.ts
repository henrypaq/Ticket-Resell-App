import { describe, expect, it } from "vitest";
import { explicitAcquisitionSrc, looksLikeInstagram, parseLastSrc } from "./beta-acquisition";

/**
 * The bare apex URL in the Instagram bio has no `?src=` to read, so these two
 * signals are the whole of its attribution. A regression here doesn't throw —
 * it silently files every bio click under the wrong channel.
 */
describe("looksLikeInstagram", () => {
  it("recognises the in-app browser by User-Agent", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Mobile/21F79 Instagram 336.0.0.25.90 (iPhone15,2; iOS 17_5)";
    expect(looksLikeInstagram(ua, null)).toBe(true);
  });

  it("recognises the Android in-app browser", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 336.1.0.41.91 Android";
    expect(looksLikeInstagram(ua, null)).toBe(true);
  });

  it("falls back to the l.instagram.com referrer when the tap escapes to the system browser", () => {
    const plainChrome =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/126.0.0.0 Mobile Safari/537.36";
    expect(looksLikeInstagram(plainChrome, "https://l.instagram.com/")).toBe(true);
    expect(looksLikeInstagram(plainChrome, "https://www.instagram.com/mcgill.tickets/")).toBe(true);
  });

  it("does not claim a plain browser visit with no referrer", () => {
    const safari =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    expect(looksLikeInstagram(safari, null)).toBe(false);
    expect(looksLikeInstagram(null, null)).toBe(false);
    expect(looksLikeInstagram(safari, "not a url")).toBe(false);
  });

  it("is not fooled by a lookalike host", () => {
    const safari = "Mozilla/5.0 (iPhone) Safari/604.1";
    expect(looksLikeInstagram(safari, "https://instagram.com.evil.example/")).toBe(false);
    expect(looksLikeInstagram(safari, "https://notinstagram.com/")).toBe(false);
  });
});

describe("explicitAcquisitionSrc", () => {
  it("returns only channels a URL is allowed to set", () => {
    expect(explicitAcquisitionSrc("ig_bio")).toBe("ig_bio");
    expect(explicitAcquisitionSrc("cafe_soldout")).toBe("cafe_soldout");
    // Ops-only labels can't be claimed from a query string.
    expect(explicitAcquisitionSrc("manual")).toBeNull();
    expect(explicitAcquisitionSrc(null)).toBeNull();
  });

  it("does not silently map an unknown src onto a real channel", () => {
    expect(explicitAcquisitionSrc("ig_story_cafe_0914")).toBeNull();
  });
});

describe("parseLastSrc", () => {
  it("keeps a campaign tag verbatim, lowercased", () => {
    expect(parseLastSrc("ig_story_cafe_0914")).toBe("ig_story_cafe_0914");
    expect(parseLastSrc("IG-Story-Piknik")).toBe("ig-story-piknik");
  });

  it("rejects anything that isn't a plain slug", () => {
    expect(parseLastSrc("")).toBeNull();
    expect(parseLastSrc(null)).toBeNull();
    expect(parseLastSrc("_leading")).toBeNull();
    expect(parseLastSrc("has spaces")).toBeNull();
    expect(parseLastSrc("<script>")).toBeNull();
    expect(parseLastSrc("a".repeat(41))).toBeNull();
    expect(parseLastSrc("a".repeat(40))).toBe("a".repeat(40));
  });
});
