import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OpsLoginForm } from "@/components/beta-ops/login-form";
import { getBetaOpsSession } from "@/domains/beta-ops/auth";
import { betaOpsConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Ops sign in · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsLoginPage() {
  if (!betaOpsConfigured()) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <p className="text-[17px] font-semibold text-[#ffe500]">mcgill.tickets</p>
        <h1 className="headline mt-4 text-[28px]">Ops isn’t configured</h1>
        <p className="mt-3 text-[14px] text-muted">
          Set <code className="text-ink">BETA_OPS_PASSWORD</code> and{" "}
          <code className="text-ink">BETA_OPS_SECRET</code> in the environment, then redeploy.
        </p>
      </div>
    );
  }

  const session = await getBetaOpsSession();
  if (session) redirect("/ops");

  return <OpsLoginForm />;
}
