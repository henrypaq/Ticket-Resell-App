import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  BETA_ACQUISITION_COOKIE,
  BETA_LAST_SRC_COOKIE,
  explicitAcquisitionSrc,
  isAcquisitionChannel,
  looksLikeInstagram,
  parseLastSrc,
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

  // Two attributions, written here because cookies cannot be set from a Server
  // Component render (that 500'd the landing page).
  //
  // `/member`, `/go`, `/go/buy` and `/go/sell` are the pre-merge paths, still
  // printed on flyers and QR codes. They now redirect (next.config.ts), but the
  // proxy runs before routing, so stamping them here is what keeps attribution
  // working for anyone arriving on an old link. Whenever an entry path is
  // added or renamed, it has to be added here too or its traffic silently
  // records as `ig_bio` (DATA_CAPTURE.md § acquisition).
  const ENTRY_PATHS = new Set([
    "/",
    "/buy",
    "/sell",
    "/upcoming",
    "/done",
    "/setup",
    "/member",
    "/go",
    "/go/buy",
    "/go/sell",
  ]);
  const path = request.nextUrl.pathname;
  if (ENTRY_PATHS.has(path)) {
    const srcParam = request.nextUrl.searchParams.get("src");
    const cookieBase = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    };

    // First-touch: enum, first write wins. How this person originally found us.
    //
    // An explicit `?src=` always wins. Without one — the clean apex URL in the
    // Instagram bio — fall back to sniffing the request: Instagram's in-app
    // browser identifies itself, so a bio tap still attributes correctly with
    // nothing appended to the link. Anything we can't place reads as `other`
    // rather than being counted as a bio click it may not be.
    const existing = request.cookies.get(BETA_ACQUISITION_COOKIE)?.value;
    if (!isAcquisitionChannel(existing)) {
      const explicit = explicitAcquisitionSrc(srcParam);
      const detected = looksLikeInstagram(
        request.headers.get("user-agent"),
        request.headers.get("referer"),
      )
        ? "ig_bio"
        : "other";
      response.cookies.set(BETA_ACQUISITION_COOKIE, explicit ?? detected, {
        ...cookieBase,
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    // Last-touch: free-form tag, every tagged visit overwrites. Which link
    // produced the lead they're about to submit — the story posted tonight,
    // not the bio link they clicked in August. Only set when the visit
    // actually carries a usable tag, so an untagged visit leaves the previous
    // one alone rather than blanking it mid-flow.
    const lastSrc = parseLastSrc(srcParam);
    if (lastSrc) {
      response.cookies.set(BETA_LAST_SRC_COOKIE, lastSrc, {
        ...cookieBase,
        maxAge: 60 * 60 * 24 * 30,
      });

      // Once per browser session per src — count story/link opens without
      // flooding the table on every navigation after the first hit.
      const seenRaw = request.cookies.get("passe_src_opens")?.value ?? "";
      const seen = new Set(
        seenRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
      if (!seen.has(lastSrc)) {
        seen.add(lastSrc);
        response.cookies.set("passe_src_opens", [...seen].slice(-24).join(","), {
          ...cookieBase,
          maxAge: 60 * 60 * 12,
        });
        const trackUrl = new URL("/api/v1/track/campaign-open", request.nextUrl.origin);
        void fetch(trackUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: request.headers.get("cookie") ?? "",
            "user-agent": request.headers.get("user-agent") ?? "",
            "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
          },
          body: JSON.stringify({ src: lastSrc, path }),
        }).catch(() => {});
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|flyers|manifest.webmanifest|sw.js|icon.*\\.png$|.*\\.svg$).*)"],
};
