import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BETA_ACQUISITION_COOKIE, BETA_LAST_SRC_COOKIE } from "@/lib/beta-acquisition";
import { GO_CONTACT_COOKIE } from "@/domains/beta-go/shared";
import {
  QUICK_BUYER_COOKIE,
  QUICK_DRAFT_COOKIE,
  QUICK_SELLER_COOKIE,
} from "@/domains/beta-quick/shared";

const BETA_SIGNUP_COOKIE = "passe_beta_signup";

/**
 * One-shot wipe of beta browser cookies so a device can retest as a new visitor.
 * Safe: equivalent to clearing site cookies manually.
 */
export async function GET(request: Request) {
  const jar = await cookies();
  jar.delete(BETA_SIGNUP_COOKIE);
  jar.delete(GO_CONTACT_COOKIE);
  jar.delete(QUICK_BUYER_COOKIE);
  jar.delete(QUICK_SELLER_COOKIE);
  jar.delete(QUICK_DRAFT_COOKIE);
  jar.delete(BETA_ACQUISITION_COOKIE);
  jar.delete(BETA_LAST_SRC_COOKIE);

  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/";
  return NextResponse.redirect(new URL(next, url.origin));
}
