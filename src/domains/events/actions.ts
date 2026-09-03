"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/domains/users/session";
import { logEvent } from "@/lib/analytics/log";
import { inspectSourceUrl, requestEvent, requestEventSchema } from "./service";

export type RequestEventFormState = {
  error?: string;
  field?: string;
  success?: boolean;
  parsed?: Awaited<ReturnType<typeof inspectSourceUrl>>;
};

/** Autofill step: fetch the source URL and return whatever could be parsed. */
export async function autofillFromUrlAction(
  _prev: RequestEventFormState,
  formData: FormData,
): Promise<RequestEventFormState> {
  await requireSessionUser();
  const url = z.string().trim().url().safeParse(formData.get("sourceUrl"));
  if (!url.success) {
    return { error: "Paste a full link, starting with https://" };
  }

  const parsed = await inspectSourceUrl(url.data);
  return { parsed };
}

export async function requestEventAction(
  _prev: RequestEventFormState,
  formData: FormData,
): Promise<RequestEventFormState> {
  const user = await requireSessionUser();

  const parsed = requestEventSchema.safeParse({
    sourceUrl: formData.get("sourceUrl") || undefined,
    name: formData.get("name"),
    venue: formData.get("venue"),
    city: formData.get("city") || "Montreal",
    startsAt: formData.get("startsAt"),
    originalPrice: formData.get("originalPrice"),
    autofilled: formData.get("autofilled") === "true",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: String(issue.path[0] ?? "") };
  }

  const result = await requestEvent({ id: user.id }, parsed.data);
  if (!result.ok) {
    return { error: result.error, field: result.field };
  }

  revalidatePath("/sell");
  return { success: true };
}

const SHARE_CHANNELS = ["copy_link", "sms", "whatsapp", "email"] as const;

/**
 * Called directly from the client ShareSheet — server actions can be invoked
 * from a client component without a separate API route. Logs the
 * DATA_CAPTURE.md `share_link_created` event; never blocks the actual share,
 * so it fires after the OS/app hand-off has already started.
 */
export async function logShareAction(eventId: string, channel: string, listingId?: string): Promise<void> {
  const user = await requireSessionUser();
  const parsedChannel = z.enum(SHARE_CHANNELS).safeParse(channel);
  const parsedEventId = z.string().uuid().safeParse(eventId);
  const parsedListingId = listingId ? z.string().uuid().safeParse(listingId) : undefined;
  if (!parsedChannel.success || !parsedEventId.success) return;

  await logEvent({
    type: "share_link_created",
    userId: user.id,
    eventRefId: parsedEventId.data,
    listingRefId: parsedListingId?.success ? parsedListingId.data : null,
    metadata: { channel: parsedChannel.data },
  });
}
