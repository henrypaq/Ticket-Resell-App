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

function parseOptionalMoney(
  formData: FormData,
  key: string,
  max = 5000,
): number | null | { error: string } {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    return { error: `${key} must be a valid amount.` };
  }
  return Math.round(n * 100) / 100;
}

function parseFixedPriceExtras(formData: FormData, enabled: boolean) {
  if (!enabled) {
    return {
      listPriceEach: null as number | null,
      discountEach: null as number | null,
      discountLabel: null as string | null,
      serviceFeeEach: null as number | null,
    };
  }
  const list = parseOptionalMoney(formData, "listPriceEach");
  if (list && typeof list === "object" && "error" in list) return list;
  const discount = parseOptionalMoney(formData, "discountEach");
  if (discount && typeof discount === "object" && "error" in discount) return discount;
  const fee = parseOptionalMoney(formData, "serviceFeeEach", 500);
  if (fee && typeof fee === "object" && "error" in fee) return fee;
  const discountLabel = String(formData.get("discountLabel") ?? "").trim().slice(0, 80) || null;
  return {
    listPriceEach: list as number | null,
    discountEach: discount as number | null,
    discountLabel,
    serviceFeeEach: fee as number | null,
  };
}

function parseFixedPriceEach(formData: FormData): number | null | { error: string } {
  const enabled =
    formData.get("fixedPriceEnabled") === "on" || formData.get("fixedPriceEnabled") === "1";
  if (!enabled) return null;
  const raw = String(formData.get("fixedPriceEach") ?? "").trim();
  if (!raw) return { error: "Enter the predetermined ticket price, or turn the option off." };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 5000) {
    return { error: "Predetermined price must be between $0 and $5000." };
  }
  return Math.round(n * 100) / 100;
}

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

  const fixedParsed = parseFixedPriceEach(formData);
  if (fixedParsed && typeof fixedParsed === "object" && "error" in fixedParsed) {
    return { error: fixedParsed.error };
  }
  const fixedPriceEach = fixedParsed as number | null;
  const extras = parseFixedPriceExtras(formData, fixedPriceEach != null);
  if (extras && typeof extras === "object" && "error" in extras) {
    return { error: (extras as { error: string }).error };
  }
  const pricing = extras as {
    listPriceEach: number | null;
    discountEach: number | null;
    discountLabel: string | null;
    serviceFeeEach: number | null;
  };

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
      fixedPriceEach,
      listPriceEach: pricing.listPriceEach,
      discountEach: pricing.discountEach,
      discountLabel: pricing.discountLabel,
      serviceFeeEach: pricing.serviceFeeEach,
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

export type UpdateEventState = {
  ok?: true;
  error?: string;
  message?: string;
};

/**
 * Edit an existing catalog event (DB or static seed). New flyer is optional —
 * leave it blank to keep the current image. Static seeds are promoted into
 * `beta_event_catalog` on first save.
 */
export async function updateCatalogEventAction(
  _prev: UpdateEventState,
  formData: FormData,
): Promise<UpdateEventState> {
  try {
    await requireBetaOpsSession();
  } catch {
    return { error: "Session expired. Sign in again." };
  }

  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return { error: "Missing event." };

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

  const days =
    scheduleMode === "recurring" ? parseWeekdaysFromForm(formData.getAll("days")) : [];
  const extraDateKeys =
    scheduleMode === "one_off" && /^\d{4}-\d{2}-\d{2}$/.test(oneOffDate) ? [oneOffDate] : [];

  const fixedParsed = parseFixedPriceEach(formData);
  if (fixedParsed && typeof fixedParsed === "object" && "error" in fixedParsed) {
    return { error: fixedParsed.error };
  }
  const fixedPriceEach = fixedParsed as number | null;
  const extras = parseFixedPriceExtras(formData, fixedPriceEach != null);
  if (extras && typeof extras === "object" && "error" in extras) {
    return { error: (extras as { error: string }).error };
  }
  const pricing = extras as {
    listPriceEach: number | null;
    discountEach: number | null;
    discountLabel: string | null;
    serviceFeeEach: number | null;
  };

  let flyerUrl = String(formData.get("existingFlyerUrl") ?? "").trim();
  let flyerPath = String(formData.get("existingFlyerPath") ?? "").trim() || null;

  const flyer = formData.get("flyer");
  if (flyer instanceof File && flyer.size > 0) {
    const uploaded = await uploadEventFlyer(slug, {
      bytes: new Uint8Array(await flyer.arrayBuffer()),
      name: flyer.name,
      contentType: flyer.type || "image/jpeg",
    });
    if (!uploaded.ok) return { error: uploaded.error };
    flyerUrl = uploaded.url;
    flyerPath = uploaded.path;
  }

  if (!flyerUrl) {
    return { error: "Add a flyer image, or keep the current one." };
  }

  const result = await upsertCatalogEvent({
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
    fixedPriceEach,
    listPriceEach: pricing.listPriceEach,
    discountEach: pricing.discountEach,
    discountLabel: pricing.discountLabel,
    serviceFeeEach: pricing.serviceFeeEach,
    flyerUrl,
    flyerPath,
  });

  if (!result.ok) return { error: result.error };
  return { ok: true, message: "Event updated." };
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
