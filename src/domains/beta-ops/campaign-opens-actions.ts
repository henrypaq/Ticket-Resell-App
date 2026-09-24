"use server";

import { getCampaignLinkStats } from "@/domains/beta-ops/campaign-opens";
import type { CampaignLinkStats } from "@/domains/beta-ops/campaign-open-types";

export async function getCampaignLinkStatsAction(
  src: string,
): Promise<CampaignLinkStats | { error: string }> {
  try {
    return await getCampaignLinkStats(src);
  } catch {
    return { error: "Couldn't load opens for that link." };
  }
}
