import type { Metadata } from "next";
import { GoDoneScreen } from "@/components/beta-quick/done";

export const metadata: Metadata = {
  title: "You're in · mcgill.tickets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GoDonePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const params = await searchParams;
  const intent = params.intent === "sell" ? "sell" : "buy";
  return <GoDoneScreen intent={intent} />;
}
