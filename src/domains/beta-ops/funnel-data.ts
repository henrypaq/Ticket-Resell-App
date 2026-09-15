import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildFunnelReport,
  type FunnelCompletedEvent,
  type FunnelReport,
  type FunnelStepEvent,
} from "@/domains/beta-ops/funnel";

export async function getOpsFunnelReports(days = 14): Promise<{
  buy: FunnelReport;
  sell: FunnelReport;
  since: string;
}> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();

  const { data, error } = await admin
    .from("analytics_events")
    .select("event_type, metadata, occurred_at")
    .in("event_type", ["beta_flow_step", "beta_flow_completed"])
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: true })
    .limit(5000);

  if (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "ops_funnel_query_failed", error }));
  }

  const steps: FunnelStepEvent[] = [];
  const completed: FunnelCompletedEvent[] = [];

  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const intent = meta.intent === "sell" ? "sell" : meta.intent === "buy" ? "buy" : null;
    if (!intent) continue;
    const at = row.occurred_at as string;
    const eventSlug = typeof meta.event_slug === "string" ? meta.event_slug : null;
    const src = typeof meta.src === "string" ? meta.src : null;

    if (row.event_type === "beta_flow_step") {
      const step = typeof meta.step === "string" ? meta.step : "";
      if (!step) continue;
      steps.push({ intent, step, eventSlug, src, at });
    } else if (row.event_type === "beta_flow_completed") {
      completed.push({ intent, eventSlug, src, at });
    }
  }

  return {
    buy: buildFunnelReport({ intent: "buy", steps, completed }),
    sell: buildFunnelReport({ intent: "sell", steps, completed }),
    since,
  };
}
