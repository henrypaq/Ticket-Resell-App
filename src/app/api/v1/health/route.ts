import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ status: "ok", version: "v1", time: new Date().toISOString() });
}
