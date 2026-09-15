import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { LinksGenerator } from "@/components/beta-ops/links-generator";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { supportedBetaEvents } from "@/lib/beta-events";

export const metadata: Metadata = {
  title: "Links · Ops · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, "") ||
    "https://mcgilltickets.party"
  );
}

export default async function OpsLinksPage() {
  if (!(await getBetaOpsSession())) redirect("/ops/login");

  const events = supportedBetaEvents().map((e) => ({ slug: e.slug, name: e.name }));

  return (
    <OpsChrome active="links">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-zinc-100">Campaign links</h1>
        <p className="mt-1 text-xs text-zinc-400">
          Generate buyer and seller deep links for Instagram. Each click tags the lead with{" "}
          <code className="text-zinc-300">src</code> so it shows under Leads by link / QR.
        </p>
      </div>
      <LinksGenerator events={events} origin={siteOrigin()} />
    </OpsChrome>
  );
}
