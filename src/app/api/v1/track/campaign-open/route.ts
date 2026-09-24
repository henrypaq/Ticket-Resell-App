import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseLastSrc } from "@/lib/beta-acquisition";
import { GO_CONTACT_COOKIE } from "@/domains/beta-go/shared";
import { recordCampaignLinkOpen } from "@/domains/beta-ops/campaign-opens";

export const dynamic = "force-dynamic";

/**
 * Public beacon for ops campaign links. Proxy fires this once per src/session
 * when a visitor lands with `?src=`. No secrets — src shape is validated and
 * write volume is bounded by the once-per-session cookie on the proxy.
 */
export async function POST(request: Request) {
  let body: { src?: string; path?: string } = {};
  try {
    body = (await request.json()) as { src?: string; path?: string };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const src = parseLastSrc(body.src);
  if (!src) return NextResponse.json({ ok: false }, { status: 400 });

  const jar = await cookies();
  const contactId = jar.get(GO_CONTACT_COOKIE)?.value ?? null;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || null;

  await recordCampaignLinkOpen({
    src,
    path: typeof body.path === "string" ? body.path : null,
    userAgent: request.headers.get("user-agent"),
    contactId,
    ip,
  });

  return NextResponse.json({ ok: true });
}
