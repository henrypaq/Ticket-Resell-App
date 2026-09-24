import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsChrome } from "@/components/beta-ops/chrome";
import { LinksGenerator } from "@/components/beta-ops/links-generator";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { getSupportedBetaEvents } from "@/domains/beta-events/catalog";

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

  const events = (await getSupportedBetaEvents()).map((e) => ({ slug: e.slug, name: e.name }));

  return (
    <OpsChrome active="links">
      <LinksGenerator events={events} origin={siteOrigin()} />
    </OpsChrome>
  );
}
