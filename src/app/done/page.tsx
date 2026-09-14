import type { Metadata } from "next";
import { DoneScreen } from "@/components/app/done";
import { requireMember } from "@/domains/beta-signup/gate";

export const metadata: Metadata = {
  title: "You're in · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  await requireMember();
  const params = await searchParams;
  const intent = params.intent === "sell" ? "sell" : "buy";
  return <DoneScreen intent={intent} />;
}
