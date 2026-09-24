import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FINDING_GUIDE,
  alertableFindings,
  describeFinding,
  severityRank,
  summarizeFindings,
  type IntegrityFinding,
} from "@/domains/data-capture/shared";

function finding(
  checkName: string,
  severity: IntegrityFinding["severity"],
  subjectId = "00000000-0000-4000-8000-000000000000",
): IntegrityFinding {
  return {
    checkName,
    severity,
    subjectType: "offer",
    subjectId,
    subjectLabel: null,
    eventSlug: "cafe-campus",
    detail: {},
  };
}

describe("summarizeFindings", () => {
  it("reports nothing wrong for an empty run", () => {
    const summary = summarizeFindings([]);
    expect(summary).toMatchObject({ total: 0, critical: 0, warning: 0, info: 0, worst: null });
    expect(summary.byCheck).toEqual([]);
  });

  it("counts by severity and surfaces the worst one", () => {
    const summary = summarizeFindings([
      finding("paid_offer_awaiting_payout", "warning", "a"),
      finding("unit_sold_without_paid_offer", "critical", "b"),
      finding("offer_offered_past_expiry", "info", "c"),
      finding("paid_offer_awaiting_payout", "warning", "d"),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.critical).toBe(1);
    expect(summary.warning).toBe(2);
    expect(summary.info).toBe(1);
    expect(summary.worst).toBe("critical");
  });

  it("orders checks by severity first, then by how often they fired", () => {
    const summary = summarizeFindings([
      finding("offer_offered_past_expiry", "info", "a"),
      finding("offer_offered_past_expiry", "info", "b"),
      finding("offer_offered_past_expiry", "info", "c"),
      finding("paid_offer_awaiting_payout", "warning", "d"),
      finding("unit_sold_without_paid_offer", "critical", "e"),
    ]);
    expect(summary.byCheck.map((c) => c.checkName)).toEqual([
      "unit_sold_without_paid_offer",
      "paid_offer_awaiting_payout",
      "offer_offered_past_expiry",
    ]);
    expect(summary.byCheck[2].count).toBe(3);
  });

  it("promotes warning to worst when there is no critical", () => {
    expect(summarizeFindings([finding("paid_offer_awaiting_payout", "warning")]).worst).toBe(
      "warning",
    );
  });
});

describe("alertableFindings", () => {
  it("wakes someone up only for critical rows", () => {
    const alertable = alertableFindings([
      finding("unit_withdrawn_with_paid_offer", "critical", "a"),
      finding("paid_offer_awaiting_payout", "warning", "b"),
      finding("offer_offered_past_expiry", "info", "c"),
    ]);
    expect(alertable).toHaveLength(1);
    expect(alertable[0].checkName).toBe("unit_withdrawn_with_paid_offer");
  });
});

describe("describeFinding", () => {
  it("returns the recorded guidance", () => {
    expect(describeFinding("paid_offer_awaiting_payout").action).toMatch(/payout/i);
  });

  it("degrades to a readable label for a check it has never seen", () => {
    const guide = describeFinding("some_future_check");
    expect(guide.title).toBe("some future check");
    expect(guide.action).toMatch(/no guidance/i);
  });
});

describe("severityRank", () => {
  it("sorts critical before warning before info", () => {
    expect([severityRank("info"), severityRank("critical"), severityRank("warning")].sort()).toEqual(
      [0, 1, 2],
    );
  });
});

/**
 * The guide and the SQL have to stay in step: a check that fires with no
 * guidance shows an ops operator a column name and nothing else. Reading the
 * migration keeps this honest without anyone remembering to update two files.
 */
describe("FINDING_GUIDE vs the integrity view", () => {
  // Both halves of the view: the resale checks and the fixed-price ones that
  // 20260924090100 unions onto them.
  const migration = [
    "20260923090300_data_capture_integrity.sql",
    "20260924090100_data_capture_fixed_price_integrity.sql",
    "20260924091000_data_capture_fixed_price_corrections.sql",
  ]
    .map((name) =>
      readFileSync(
        fileURLToPath(new URL(`../../../supabase/migrations/${name}`, import.meta.url)),
        "utf8",
      ),
    )
    .join("\n");

  const checkNames = new Set<string>();
  // Each view's first block names the column; every later block is positional.
  for (const m of migration.matchAll(/'([a-z0-9_]+)'::text as check_name/g)) {
    checkNames.add(m[1]);
  }
  for (const m of migration.matchAll(/select '([a-z0-9_]+)', '(critical|warning|info)'/g)) {
    checkNames.add(m[1]);
  }

  it("found the checks in the migration", () => {
    expect(checkNames.size).toBeGreaterThan(10);
  });

  it("has guidance for every check the view can emit", () => {
    const missing = [...checkNames].filter((name) => !(name in FINDING_GUIDE));
    expect(missing).toEqual([]);
  });

  it("has no guidance for checks that no longer exist", () => {
    const stale = Object.keys(FINDING_GUIDE).filter((name) => !checkNames.has(name));
    expect(stale).toEqual([]);
  });
});
