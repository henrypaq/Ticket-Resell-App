import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireBetaOpsSession } from "@/domains/beta-ops/auth";
import {
  BETA_WEEKDAYS,
  type BetaWeekday,
} from "@/lib/beta-events";
import { publicFlyerUrlFromPath } from "@/domains/beta-events/catalog";

const weekdaySchema = z.enum(BETA_WEEKDAYS);

const upsertSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case."),
    name: z.string().trim().min(1).max(160),
    venue: z.string().trim().min(1).max(160),
    city: z.string().trim().min(1).max(80).default("Montreal"),
    blurb: z.string().trim().max(500).default(""),
    days: z.array(weekdaySchema).default([]),
    extraDateKeys: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .default([]),
    supported: z.boolean().default(true),
    entryNote: z.string().trim().max(200).optional().nullable(),
    doorsHour: z.coerce.number().int().min(0).max(23).optional().nullable(),
    flyerUrl: z.string().trim().min(1).max(500).optional(),
    flyerPath: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.supported && value.days.length === 0 && value.extraDateKeys.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one weekday or a specific date before posting.",
        path: ["extraDateKeys"],
      });
    }
  });

export type UpsertCatalogEventInput = z.infer<typeof upsertSchema>;

export function slugifyEventName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function upsertCatalogEvent(
  input: UpsertCatalogEventInput,
  opts?: { createdBy?: string },
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  await requireBetaOpsSession();
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid event." };
  }
  const data = parsed.data;
  if (!data.flyerUrl) {
    return { ok: false, error: "Add a flyer image." };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("beta_event_catalog").upsert(
    {
      slug: data.slug,
      name: data.name,
      venue: data.venue,
      city: data.city,
      blurb: data.blurb,
      flyer_url: data.flyerUrl,
      flyer_path: data.flyerPath ?? null,
      days: data.days,
      extra_date_keys: data.extraDateKeys,
      supported: data.supported,
      entry_note: data.entryNote || null,
      doors_hour: data.doorsHour ?? null,
      updated_at: now,
      created_by: opts?.createdBy ?? null,
    },
    { onConflict: "slug" },
  );

  if (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "catalog_upsert_failed", error }));
    return { ok: false, error: "Couldn't save that event." };
  }
  return { ok: true, slug: data.slug };
}

export async function setCatalogEventSupported(
  slug: string,
  supported: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireBetaOpsSession();
  const admin = createAdminClient();

  // If only in static seed, promote a copy into DB first.
  const { data: existing } = await admin
    .from("beta_event_catalog")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!existing) {
    const { BETA_EVENTS } = await import("@/lib/beta-events");
    const seed = BETA_EVENTS.find((e) => e.slug === slug);
    if (!seed) return { ok: false, error: "Unknown event." };
    const created = await upsertCatalogEvent({
      slug: seed.slug,
      name: seed.name,
      venue: seed.venue,
      city: seed.city,
      blurb: seed.blurb,
      days: seed.days,
      extraDateKeys: seed.extraDateKeys ?? [],
      supported,
      entryNote: seed.entryNote ?? null,
      doorsHour: seed.doorsHour ?? null,
      flyerUrl: seed.flyerUrl,
      flyerPath: null,
    });
    return created.ok ? { ok: true } : created;
  }

  const { error } = await admin
    .from("beta_event_catalog")
    .update({ supported, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) return { ok: false, error: "Couldn't update that." };
  return { ok: true };
}

export async function uploadEventFlyer(
  slug: string,
  file: { bytes: Uint8Array; name: string; contentType: string },
): Promise<{ ok: true; path: string; url: string } | { ok: false; error: string }> {
  await requireBetaOpsSession();
  if (!file.bytes.length) return { ok: false, error: "Empty file." };
  if (file.bytes.length > 5 * 1024 * 1024) {
    return { ok: false, error: "Flyer must be under 5 MB." };
  }
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.contentType)) {
    return { ok: false, error: "Use a JPEG, PNG, or WebP flyer." };
  }

  const ext =
    file.contentType === "image/png" ? "png" : file.contentType === "image/webp" ? "webp" : "jpg";
  const path = `${slug}/${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("beta-event-flyers").upload(path, file.bytes, {
    contentType: file.contentType,
    upsert: true,
  });
  if (error) {
    console.warn(JSON.stringify({ level: "warn", msg: "event_flyer_upload_failed", error }));
    return { ok: false, error: "Couldn't upload the flyer." };
  }
  return { ok: true, path, url: publicFlyerUrlFromPath(path) };
}

export function parseWeekdaysFromForm(raw: FormDataEntryValue[]): BetaWeekday[] {
  const out: BetaWeekday[] = [];
  for (const value of raw) {
    const s = String(value);
    if ((BETA_WEEKDAYS as readonly string[]).includes(s)) out.push(s as BetaWeekday);
  }
  return out;
}
