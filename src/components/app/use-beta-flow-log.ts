"use client";

import { useEffect, useRef } from "react";
import {
  logBetaFlowCompletedAction,
  logBetaFlowStepAction,
} from "@/domains/beta-quick/funnel-log";

/**
 * Fire-and-forget step logging for buy/sell flows. Dedupes identical
 * intent+step+event within the same mount so Strict Mode double-effects
 * don't double-count.
 */
export function useBetaFlowStepLog(args: {
  intent: "buy" | "sell";
  stepKey: string;
  eventSlug?: string | null;
  enabled?: boolean;
}) {
  const last = useRef<string>("");
  useEffect(() => {
    if (args.enabled === false) return;
    const key = `${args.intent}:${args.stepKey}:${args.eventSlug ?? ""}`;
    if (last.current === key) return;
    last.current = key;
    void logBetaFlowStepAction({
      intent: args.intent,
      step: args.stepKey,
      eventSlug: args.eventSlug,
    });
  }, [args.intent, args.stepKey, args.eventSlug, args.enabled]);
}

export function logFlowCompleted(args: {
  intent: "buy" | "sell";
  eventSlug?: string | null;
}) {
  void logBetaFlowCompletedAction(args);
}
