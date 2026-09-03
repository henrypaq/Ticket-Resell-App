import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/analytics/log";
import { sanitizeNextPath } from "@/lib/next-path";

/**
 * OAuth landing route (Google). Separate from /auth/confirm, which handles the
 * email magic-link token hash — the two flows exchange different artefacts.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    const isNew =
      data.user.created_at && Date.now() - new Date(data.user.created_at).getTime() < 60_000;
    await logEvent({
      type: isNew ? "signup_completed" : "login",
      userId: data.user.id,
      metadata: { method: "google_oauth" },
    });
  }

  const safeNext = sanitizeNextPath(searchParams.get("next"));
  return NextResponse.redirect(safeNext ? `${origin}${safeNext}` : origin);
}
