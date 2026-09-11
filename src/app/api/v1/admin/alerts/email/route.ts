import { NextResponse } from "next/server";
import { z } from "zod";
import { notifyAdminsOfBetaInterest } from "@/domains/admin-alerts/service";
import { cronSecret, resendConfigured } from "@/lib/env";

/**
 * Manual / test trigger for admin interest emails.
 *
 * Auth: Bearer $CRON_SECRET. Product path calls notifyAdminsOfBetaInterest
 * directly from waitlist/sell saves.
 *
 * POST /api/v1/admin/alerts/email
 */
const bodySchema = z.object({
  signupId: z.string().uuid(),
  eventSlug: z.string().trim().min(1).max(80),
  intent: z.enum(["waitlist", "sell"]),
  contactPhone: z.string().trim().max(30).optional(),
  contactInstagram: z.string().trim().max(40).optional(),
  waitlistPosition: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  if (!resendConfigured()) {
    return NextResponse.json({ error: "Resend is not configured." }, { status: 503 });
  }

  const secret = cronSecret();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body." },
      { status: 400 },
    );
  }

  await notifyAdminsOfBetaInterest(parsed.data);
  return NextResponse.json({ ok: true });
}
