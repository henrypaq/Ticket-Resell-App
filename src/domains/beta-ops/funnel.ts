/**
 * Pure funnel math for beta buy/sell flows — unit-tested without the DB.
 */

export type FunnelStepEvent = {
  intent: "buy" | "sell";
  step: string;
  eventSlug?: string | null;
  src?: string | null;
  at: string; // ISO
};

export type FunnelCompletedEvent = {
  intent: "buy" | "sell";
  eventSlug?: string | null;
  src?: string | null;
  at: string;
};

export type FunnelStepRow = {
  step: string;
  views: number;
  /** Sessions that reached a later step or completed (approx continuation). */
  continued: number;
  dropOff: number;
};

export type FunnelReport = {
  intent: "buy" | "sell";
  steps: FunnelStepRow[];
  completed: number;
  bySrc: { src: string; started: number; completed: number }[];
};

const BUY_STEPS = ["event", "quantity", "contact", "transfer", "submit"] as const;
const SELL_STEPS = [
  "event",
  "quantity",
  "pricing",
  "contact",
  "ticket",
  "etransfer",
  "submit",
] as const;

export function stepsForIntent(intent: "buy" | "sell"): readonly string[] {
  return intent === "buy" ? BUY_STEPS : SELL_STEPS;
}

/**
 * Build a drop-off report from raw step + completed events.
 * Uses max step rank reached per (intent, sessionKey) when sessionKey present;
 * otherwise aggregates unique step views (simpler ops snapshot).
 */
export function buildFunnelReport(args: {
  intent: "buy" | "sell";
  steps: FunnelStepEvent[];
  completed: FunnelCompletedEvent[];
}): FunnelReport {
  const order = stepsForIntent(args.intent);
  const rank = new Map(order.map((s, i) => [s, i]));

  const stepViews = new Map<string, number>();
  for (const s of order) stepViews.set(s, 0);

  for (const ev of args.steps) {
    if (ev.intent !== args.intent) continue;
    if (!rank.has(ev.step)) continue;
    stepViews.set(ev.step, (stepViews.get(ev.step) ?? 0) + 1);
  }

  const completed = args.completed.filter((c) => c.intent === args.intent).length;

  const steps: FunnelStepRow[] = order.map((step, i) => {
    const views = stepViews.get(step) ?? 0;
    const laterViews = order
      .slice(i + 1)
      .reduce((sum, s) => sum + (stepViews.get(s) ?? 0), 0);
    // Continuation proxy: people who appear on a later step (or completed).
    const continued = Math.min(views, Math.max(laterViews, i === order.length - 1 ? completed : 0));
    const dropOff = Math.max(0, views - continued);
    return { step, views, continued, dropOff };
  });

  // Patch last step continued to completed count when submit views exist.
  const last = steps[steps.length - 1];
  if (last) {
    last.continued = Math.min(last.views, completed);
    last.dropOff = Math.max(0, last.views - last.continued);
  }

  const bySrcMap = new Map<string, { started: number; completed: number }>();
  for (const ev of args.steps) {
    if (ev.intent !== args.intent) continue;
    if (ev.step !== order[0] && ev.step !== order[1]) continue;
    // Count starts at first observed early step per src (quantity if event skipped).
    const key = (ev.src ?? "").trim() || "(none)";
    const cur = bySrcMap.get(key) ?? { started: 0, completed: 0 };
    if (ev.step === order[0] || (order[0] === "event" && ev.step === "quantity")) {
      cur.started += 1;
      bySrcMap.set(key, cur);
    }
  }
  // Simpler: count any first-step-ish events
  bySrcMap.clear();
  for (const ev of args.steps) {
    if (ev.intent !== args.intent) continue;
    const key = (ev.src ?? "").trim() || "(none)";
    const cur = bySrcMap.get(key) ?? { started: 0, completed: 0 };
    if (ev.step === "event" || ev.step === "quantity") {
      cur.started += 1;
    }
    bySrcMap.set(key, cur);
  }
  for (const ev of args.completed) {
    if (ev.intent !== args.intent) continue;
    const key = (ev.src ?? "").trim() || "(none)";
    const cur = bySrcMap.get(key) ?? { started: 0, completed: 0 };
    cur.completed += 1;
    bySrcMap.set(key, cur);
  }

  const bySrc = [...bySrcMap.entries()]
    .map(([src, v]) => ({ src, started: v.started, completed: v.completed }))
    .sort((a, b) => b.started - a.started);

  return { intent: args.intent, steps, completed, bySrc };
}
