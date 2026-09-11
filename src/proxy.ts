import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  BETA_ACQUISITION_COOKIE,
  isAcquisitionChannel,
  parseAcquisitionSrc,
} from "@/lib/beta-acquisition";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie on every request so short-lived access
 * tokens roll over without the client holding a long-lived token
 * (SECURITY.md § session security).
 *
 * Also stamps first-touch `acquisition_channel` on `/` — cookies cannot be
 * written from a Server Component render (that 500'd the landing page).
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();

  // First-touch only. Bare `/`/`/member`/`/go` → ig_bio; `?src=qr_*` / flyer → that.
  // `/go` = Instagram-bio quick flow; `/member` = full beta member onboarding.
  const path = request.nextUrl.pathname;
  if (
    path === "/" ||
    path === "/member" ||
    path === "/go" ||
    path === "/go/buy" ||
    path === "/go/sell"
  ) {
    const existing = request.cookies.get(BETA_ACQUISITION_COOKIE)?.value;
    if (!isAcquisitionChannel(existing)) {
      response.cookies.set(
        BETA_ACQUISITION_COOKIE,
        parseAcquisitionSrc(request.nextUrl.searchParams.get("src")),
        {
          maxAge: 60 * 60 * 24 * 365,
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
        },
      );
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|flyers|manifest.webmanifest|sw.js|icon.*\\.png$|.*\\.svg$).*)"],
};
