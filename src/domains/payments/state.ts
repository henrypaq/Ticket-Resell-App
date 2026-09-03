import type { StartPurchaseState } from "./actions";

/**
 * A "use server" file may only export async functions, so the idle default
 * value lives here instead of alongside startPurchaseAction.
 */
export const idlePurchaseState: StartPurchaseState = { status: "idle" };
