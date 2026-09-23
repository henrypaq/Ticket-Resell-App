"use server";

import { requireBetaOpsSession } from "@/domains/beta-ops/auth";
import {
  parseWeekdaysFromForm,
  setCatalogEventSupported,
  slugifyEventName,
  uploadEventFlyer,
  upsertCatalogEvent,
} from "@/domains/beta-events/ops-catalog";
import type { OpsActionState } from "@/domains/beta-ops/actions";

export type CreateEventState = {
  ok?: true;
  error?: string;
  message?: string;
  slug?: string;
};

export async function createCatalogEventAction(
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  let session: { email: string };
  try {
    session = await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim() || name;
  const city = String(formData.get("city") ?? "Montreal").trim() || "Montreal";
  const blurb = String(formData.get("blurb") ?? "").trim();
  const entryNote = String(formData.get("entryNote") ?? "").trim() || null;
  const doorsRaw = String(formData.get("doorsHour") ?? "").trim();
  const doorsHour = doorsRaw === "" ? null : Number(doorsRaw);
  const scheduleMode = String(formData.get("scheduleMode") ?? "one_off");
  const oneOffDate = String(formData.get("oneOffDate") ?? "").trim();
  const supported = formData.get("supported") === "on" || formData.get("supported") === "1";
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug =
    slugInput ||
    (scheduleMode === "one_off" && oneOffDate
      ? `${slugifyEventName(name)}-${oneOffDate}`
      : slugifyEventName(name));

  const days =
    scheduleMode === "recurring" ? parseWeekdaysFromForm(formData.getAll("days")) : [];
  const extraDateKeys =
    scheduleMode === "one_off" && /^\d{4}-\d{2}-\d{2}$/.test(oneOffDate) ? [oneOffDate] : [];

  const flyer = formData.get("flyer");
  if (!(flyer instanceof File) || flyer.size === 0) {
    return { error: "Add a flyer image (JPEG, PNG, or WebP)." };
  }

  const uploaded = await uploadEventFlyer(slug, {
    bytes: new Uint8Array(await flyer.arrayBuffer()),
    name: flyer.name,
    contentType: flyer.type || "image/jpeg",
  });
  if (!uploaded.ok) return { error: uploaded.error };

  const result = await upsertCatalogEvent(
    {
      slug,
      name,
      venue,
      city,
      blurb: blurb || `${name} at ${venue}.`,
      days,
      extraDateKeys,
      supported,
      entryNote,
      doorsHour: Number.isFinite(doorsHour) ? doorsHour : null,
      flyerUrl: uploaded.url,
      flyerPath: uploaded.path,
    },
    { createdBy: session.email },
  );

  if (!result.ok) return { error: result.error };
  return {
    ok: true,
    slug: result.slug,
    message: supported
      ? "Posted — it's live on the board for the dates you set."
      : "Saved as draft (not shown on the public board).",
  };
}

export async function toggleCatalogEventAction(
  slug: string,
  supported: boolean,
): Promise<OpsActionState> {
  try {
    await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }
  const result = await setCatalogEventSupported(slug, supported);
  if (!result.ok) return { error: result.error };
  return { ok: true };
}
