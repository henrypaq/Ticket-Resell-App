import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Public apex URL (`mcgilltickets.party` — Instagram bio). Sends people to the
 * low-friction `/go` buy/sell hub. Full member onboarding stays at `/member`
 * (QR codes link there directly with `?src=qr_*`).
 */
export default async function RootRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) for (const v of value) qs.append(key, v);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/go?${suffix}` : "/go");
}
