export type CampaignLinkOpen = {
  id: string;
  src: string;
  openedAt: string;
  path: string | null;
  userAgent: string | null;
  contactId: string | null;
  label: string;
};

export type CampaignLinkConvert = {
  leadId: string;
  createdAt: string;
  intent: string;
  eventSlug: string;
  label: string;
};

export type CampaignLinkStats = {
  src: string;
  openCount: number;
  opens: CampaignLinkOpen[];
  converts: CampaignLinkConvert[];
};
