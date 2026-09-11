import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  betaOpsConfigured,
  betaOpsEmails,
  betaOpsPassword,
  betaOpsSecret,
} from "@/lib/env";

export const BETA_OPS_COOKIE = "passe_beta_ops";

/** 30 days — stay signed in on the same browser. */
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

type SessionPayload = {
  email: string;
  exp: number;
};

function sign(payload: string): string {
  return createHmac("sha256", betaOpsSecret()).update(payload).digest("base64url");
}

function encodeSession(email: string): string {
  const body: SessionPayload = {
    email: email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!data.email || typeof data.exp !== "number") return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    if (!betaOpsEmails().includes(data.email.toLowerCase())) return null;
    return data;
  } catch {
    return null;
  }
}

function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // Still run a compare to reduce trivial timing leaks on length.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export async function getBetaOpsSession(): Promise<{ email: string } | null> {
  if (!betaOpsConfigured()) return null;
  const jar = await cookies();
  const raw = jar.get(BETA_OPS_COOKIE)?.value;
  if (!raw) return null;
  const session = decodeSession(raw);
  if (!session) return null;
  return { email: session.email };
}

export async function requireBetaOpsSession(): Promise<{ email: string }> {
  const session = await getBetaOpsSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export type BetaOpsLoginResult =
  | { ok: true }
  | { ok: false; error: string };

export async function loginBetaOps(email: string, password: string): Promise<BetaOpsLoginResult> {
  if (!betaOpsConfigured()) {
    return { ok: false, error: "Ops login isn’t configured yet." };
  }

  const normalized = email.trim().toLowerCase();
  if (!betaOpsEmails().includes(normalized)) {
    return { ok: false, error: "Wrong email or password." };
  }
  if (!safeEqualString(password, betaOpsPassword())) {
    return { ok: false, error: "Wrong email or password." };
  }

  const jar = await cookies();
  jar.set(BETA_OPS_COOKIE, encodeSession(normalized), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });

  return { ok: true };
}

export async function logoutBetaOps(): Promise<void> {
  const jar = await cookies();
  jar.delete(BETA_OPS_COOKIE);
}
