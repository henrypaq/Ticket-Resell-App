import "server-only";

import Stripe from "stripe";
import { stripeSecretKey } from "@/lib/env";

export { toCents, fromCents } from "./money";

let cached: Stripe | null = null;

/**
 * Lazily constructed so that importing this module never throws when the keys
 * are absent — callers gate on stripeConfigured() before getting here.
 */
export function getStripe(): Stripe {
  if (!cached) {
    cached = new Stripe(stripeSecretKey(), {
      // Outbound calls to a third party always get a timeout and bounded
      // retries (ARCHITECTURE.md § resilience).
      timeout: 15_000,
      maxNetworkRetries: 2,
    });
  }
  return cached;
}
