import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Public apex URL used by QR codes (`/?src=…`). Member onboarding + shell
 * live at `/member`; `/go` is the low-friction Instagram bio flow.
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
  redirect(suffix ? `/member?${suffix}` : "/member");
}
