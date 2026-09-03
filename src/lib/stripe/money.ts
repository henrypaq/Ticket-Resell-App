/** Stripe works in the smallest currency unit; CAD cents here. Pure — no server-only import, so it's unit-testable and safe to use from client code that just needs to format an amount. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}
