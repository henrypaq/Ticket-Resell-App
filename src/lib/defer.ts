import "server-only";

import { after } from "next/server";

/**
 * Run a side effect (an email, mostly) without making the caller wait for it,
 * and without losing it.
 *
 * A bare `void promise` in a server action or route is fire-and-forget in the
 * worst sense on Vercel: once the response is sent the function can be frozen
 * mid-send. `after` keeps the invocation alive until the task settles. Outside
 * a request scope (a script, a test) `after` throws, so fall back to starting
 * the task directly.
 */
export function defer(task: () => Promise<unknown>): void {
  const run = async () => {
    try {
      await task();
    } catch (err) {
      console.warn(JSON.stringify({ level: "warn", msg: "deferred_task_failed", error: String(err) }));
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
