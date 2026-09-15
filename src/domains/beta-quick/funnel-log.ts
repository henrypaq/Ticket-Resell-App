"use server";

import { cookies } from "next/headers";
import { logEvent } from "@/lib/analytics/log";
import { BETA_LAST_SRC_COOKIE } from "@/lib/beta-acquisition";
import { stepsForIntent } from "@/domains/beta-ops/funnel";

export async function logBetaFlowStepAction(input: {
  intent: "buy" | "sell";
  step: string;
  eventSlug?: string | null;
}): Promise<void> {
  const allowed = stepsForIntent(input.intent);
  if (!allowed.includes(input.step)) return;

  const jar = await cookies();
  const src = jar.get(BETA_LAST_SRC_COOKIE)?.value ?? null;

  await logEvent({
    type: "beta_flow_step",
    metadata: {
      intent: input.intent,
      step: input.step,
      event_slug: input.eventSlug ?? null,
      src,
    },
  });
}

export async function logBetaFlowCompletedAction(input: {
  intent: "buy" | "sell";
  eventSlug?: string | null;
}): Promise<void> {
  const jar = await cookies();
  const src = jar.get(BETA_LAST_SRC_COOKIE)?.value ?? null;

  await logEvent({
    type: "beta_flow_completed",
    metadata: {
      intent: input.intent,
      event_slug: input.eventSlug ?? null,
      src,
    },
  });
}
