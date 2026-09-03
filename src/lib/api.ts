import { NextResponse } from "next/server";

/**
 * One response and error shape for every endpoint (ARCHITECTURE.md § API
 * design), so a client — including the Phase 5 mobile client — never has to
 * special-case per route.
 */
export type ApiError = { code: string; message: string; details?: unknown };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function fail(status: number, error: ApiError) {
  return NextResponse.json({ error }, { status });
}

export const unauthorized = () =>
  fail(401, { code: "unauthorized", message: "Sign in to use this endpoint." });

export const notFound = (what = "Resource") =>
  fail(404, { code: "not_found", message: `${what} not found.` });

export const invalid = (details: unknown) =>
  fail(422, { code: "validation_failed", message: "Request failed validation.", details });
