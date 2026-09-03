/**
 * Validates a post-login redirect target. Used everywhere a "come back here
 * after signing in" path crosses a trust boundary (a form field, a query
 * param) — a same-origin relative path only, never an absolute URL, so this
 * can't become an open redirect.
 */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (next.includes("://")) return null;
  return next;
}
