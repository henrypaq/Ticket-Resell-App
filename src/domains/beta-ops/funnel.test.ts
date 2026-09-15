import { describe, expect, it } from "vitest";
import { buildFunnelReport } from "./funnel";

describe("buildFunnelReport", () => {
  it("counts buy step views and drop-off", () => {
    const report = buildFunnelReport({
      intent: "buy",
      steps: [
        { intent: "buy", step: "event", at: "2026-09-15T12:00:00Z", src: "ig_bio" },
        { intent: "buy", step: "event", at: "2026-09-15T12:01:00Z", src: "ig_bio" },
        { intent: "buy", step: "quantity", at: "2026-09-15T12:02:00Z", src: "ig_bio" },
        { intent: "buy", step: "contact", at: "2026-09-15T12:03:00Z", src: "ig_bio" },
        { intent: "buy", step: "submit", at: "2026-09-15T12:04:00Z", src: "ig_bio" },
      ],
      completed: [{ intent: "buy", at: "2026-09-15T12:05:00Z", src: "ig_bio" }],
    });

    expect(report.steps.find((s) => s.step === "event")?.views).toBe(2);
    expect(report.steps.find((s) => s.step === "quantity")?.views).toBe(1);
    expect(report.completed).toBe(1);
    expect(report.bySrc[0]?.src).toBe("ig_bio");
  });

  it("ignores the other intent", () => {
    const report = buildFunnelReport({
      intent: "sell",
      steps: [{ intent: "buy", step: "event", at: "2026-09-15T12:00:00Z" }],
      completed: [],
    });
    expect(report.steps.every((s) => s.views === 0)).toBe(true);
  });
});
