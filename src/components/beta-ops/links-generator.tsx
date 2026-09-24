"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import QRCode from "qrcode";
import {
  URL_ACQUISITION_CHANNELS,
  ACQUISITION_CHANNEL_LABELS,
  buildCampaignLink,
  parseLastSrc,
  type AcquisitionChannel,
} from "@/lib/beta-acquisition";
import { nightlifeDateKey, isPastNightlife } from "@/lib/beta-events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type EventOption = { slug: string; name: string };

type OutputMode = "link" | "qr" | "both";

type SavedCampaign = {
  id: string;
  createdAt: string;
  /** Nightlife calendar night this campaign targets (YYYY-MM-DD). */
  nightKey: string;
  intent: "buy" | "sell" | "home";
  eventSlug: string | null;
  eventName: string | null;
  src: string;
  purposeLabel: string;
  outputMode: OutputMode;
  url: string;
  qrDataUrl: string | null;
};

const STORAGE_KEY = "passe_ops_campaign_links_v1";

const PRESET_SRCS: { value: string; label: string }[] = [
  ...URL_ACQUISITION_CHANNELS.map((c) => ({
    value: c,
    label: ACQUISITION_CHANNEL_LABELS[c as AcquisitionChannel],
  })),
  { value: "ig_story", label: "Instagram story (custom)" },
  { value: "ig_reel", label: "Instagram reel (custom)" },
  { value: "share_link", label: "Share link (custom)" },
];

const selectClass =
  "h-9 w-full rounded-md bg-zinc-950/70 px-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const inputClass =
  "h-9 w-full rounded-md bg-zinc-950/70 px-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500";

export function LinksGenerator({
  events,
  origin,
}: {
  events: EventOption[];
  origin: string;
}) {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedCampaign[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Create form state
  const [intent, setIntent] = useState<"buy" | "sell" | "home">("buy");
  const [eventSlug, setEventSlug] = useState(events[0]?.slug ?? "");
  const [preset, setPreset] = useState(PRESET_SRCS[0]?.value ?? "ig_bio");
  const [customSrc, setCustomSrc] = useState("");
  const [outputMode, setOutputMode] = useState<OutputMode>("both");
  const [previewQr, setPreviewQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedCampaign[];
        if (Array.isArray(parsed)) setSaved(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function persist(next: SavedCampaign[]) {
    setSaved(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }

  const src =
    preset === "custom"
      ? parseLastSrc(customSrc)
      : preset === "ig_story" || preset === "ig_reel" || preset === "share_link"
        ? parseLastSrc(
            customSrc.trim() || `${preset}_${eventSlug || "event"}`.replace(/-/g, "_"),
          )
        : parseLastSrc(preset);

  const purposeLabel =
    PRESET_SRCS.find((p) => p.value === preset)?.label ??
    (preset === "custom" ? customSrc || "Custom" : preset);

  const url = useMemo(
    () =>
      buildCampaignLink({
        intent,
        eventSlug: intent === "home" ? null : eventSlug,
        src,
        origin,
      }),
    [intent, eventSlug, src, origin],
  );

  useEffect(() => {
    if (view !== "create") return;
    if (outputMode === "link") {
      setPreviewQr(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: "#0B0B0C", light: "#FFFFFF" },
    })
      .then((dataUrl) => {
        if (!cancelled) setPreviewQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setPreviewQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, outputMode, view]);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy this link:", value);
    }
  }

  async function saveCampaign() {
    setSaving(true);
    try {
      let qrDataUrl: string | null = null;
      if (outputMode === "qr" || outputMode === "both") {
        qrDataUrl =
          previewQr ??
          (await QRCode.toDataURL(url, {
            width: 280,
            margin: 2,
            color: { dark: "#0B0B0C", light: "#FFFFFF" },
          }));
      }
      const event = events.find((e) => e.slug === eventSlug);
      const item: SavedCampaign = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        nightKey: nightlifeDateKey(),
        intent,
        eventSlug: intent === "home" ? null : eventSlug || null,
        eventName: intent === "home" ? null : (event?.name ?? eventSlug),
        src: src ?? "",
        purposeLabel,
        outputMode,
        url,
        qrDataUrl,
      };
      persist([item, ...saved]);
      setSelectedId(item.id);
      setView("detail");
    } finally {
      setSaving(false);
    }
  }

  function deleteCampaign(id: string) {
    const next = saved.filter((s) => s.id !== id);
    persist(next);
    setSelectedId(null);
    setView("list");
  }

  const selected = selectedId ? saved.find((s) => s.id === selectedId) : null;

  const tonightKey = nightlifeDateKey();
  const upcoming = saved.filter((s) => !isPastNightlife(s.createdAt) || s.nightKey >= tonightKey);
  // Group past by nightKey
  const pastByNight = new Map<string, SavedCampaign[]>();
  for (const s of saved) {
    if (upcoming.includes(s)) continue;
    const list = pastByNight.get(s.nightKey) ?? [];
    list.push(s);
    pastByNight.set(s.nightKey, list);
  }
  const pastNights = [...pastByNight.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Links</h1>
          <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
            Campaign links & QR codes — tagged with <code className="text-zinc-300">src</code> for
            attribution.
          </p>
        </div>
        {view === "list" && (
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 bg-amber-400 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
            onClick={() => {
              setView("create");
              setSelectedId(null);
            }}
          >
            Create link
          </Button>
        )}
      </div>

      {view === "create" && (
        <CreatePanel
          events={events}
          intent={intent}
          setIntent={setIntent}
          eventSlug={eventSlug}
          setEventSlug={setEventSlug}
          preset={preset}
          setPreset={setPreset}
          customSrc={customSrc}
          setCustomSrc={setCustomSrc}
          outputMode={outputMode}
          setOutputMode={setOutputMode}
          url={url}
          previewQr={previewQr}
          copied={copied}
          copy={copy}
          saving={saving}
          onSave={saveCampaign}
          onBack={() => setView("list")}
        />
      )}

      {view === "detail" && selected && (
        <DetailPanel
          item={selected}
          copied={copied}
          copy={copy}
          onBack={() => {
            setSelectedId(null);
            setView("list");
          }}
          onDelete={() => deleteCampaign(selected.id)}
        />
      )}

      {view === "list" && (
        <div className="mt-5 flex flex-col gap-4">
          {!hydrated ? (
            <p className="text-xs text-zinc-500">Loading saved campaigns…</p>
          ) : (
            <>
              <section>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Upcoming · {upcoming.length}
                </h2>
                {upcoming.length === 0 ? (
                  <p className="rounded-xl bg-zinc-900/60 px-3.5 py-4 text-xs text-zinc-500">
                    No saved links yet — create one for tonight’s stories or flyers.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {upcoming.map((item) => (
                      <SavedRow
                        key={item.id}
                        item={item}
                        onOpen={() => {
                          setSelectedId(item.id);
                          setView("detail");
                        }}
                      />
                    ))}
                  </ul>
                )}
              </section>

              {pastNights.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Previous nights
                  </h2>
                  {pastNights.map(([nightKey, items]) => (
                    <NightDrawer
                      key={nightKey}
                      nightKey={nightKey}
                      items={items}
                      onOpen={(id) => {
                        setSelectedId(id);
                        setView("detail");
                      }}
                    />
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CreatePanel(props: {
  events: EventOption[];
  intent: "buy" | "sell" | "home";
  setIntent: (v: "buy" | "sell" | "home") => void;
  eventSlug: string;
  setEventSlug: (v: string) => void;
  preset: string;
  setPreset: (v: string) => void;
  customSrc: string;
  setCustomSrc: (v: string) => void;
  outputMode: OutputMode;
  setOutputMode: (v: OutputMode) => void;
  url: string;
  previewQr: string | null;
  copied: string | null;
  copy: (value: string, key: string) => void;
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
}) {
  const {
    events,
    intent,
    setIntent,
    eventSlug,
    setEventSlug,
    preset,
    setPreset,
    customSrc,
    setCustomSrc,
    outputMode,
    setOutputMode,
    url,
    previewQr,
    copied,
    copy,
    saving,
    onSave,
    onBack,
  } = props;

  return (
    <div className="mt-5 rounded-xl bg-zinc-900/60">
      <div className="flex items-center gap-2 border-b border-zinc-800/60 px-3 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 gap-1 px-2 text-xs text-zinc-300"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="text-sm font-semibold text-zinc-100">New campaign</span>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        <Field label="Purpose">
          <select
            value={intent}
            onChange={(e) => setIntent(e.target.value as "buy" | "sell" | "home")}
            className={selectClass}
          >
            <option value="buy">Buyer — open buy flow</option>
            <option value="sell">Seller — open sell flow</option>
            <option value="home">Home / landing</option>
          </select>
        </Field>

        {intent !== "home" && (
          <Field label="Event">
            <select
              value={eventSlug}
              onChange={(e) => setEventSlug(e.target.value)}
              className={selectClass}
            >
              {events.map((ev) => (
                <option key={ev.slug} value={ev.slug}>
                  {ev.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Source tag">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className={selectClass}
          >
            {PRESET_SRCS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom tag…</option>
          </select>
        </Field>

        {(preset === "custom" ||
          preset === "ig_story" ||
          preset === "ig_reel" ||
          preset === "share_link") && (
          <Field label="Custom src">
            <input
              value={customSrc}
              onChange={(e) => setCustomSrc(e.target.value)}
              placeholder={
                preset === "custom" ? "ig_story_cafe_0915" : `${preset}_${eventSlug || "event"}`
              }
              className={inputClass}
            />
          </Field>
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-medium text-zinc-400">Generate</p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["link", "Link only"],
                ["qr", "QR only"],
                ["both", "Link + QR"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOutputMode(value)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  outputMode === value
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-950/70 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {(outputMode === "link" || outputMode === "both") && (
          <div className="rounded-lg bg-zinc-950/60 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Link
            </p>
            <p className="mt-1.5 break-all font-mono text-[12px] text-zinc-200">{url}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2.5 h-7 text-[11px]"
              onClick={() => copy(url, "preview")}
            >
              {copied === "preview" ? "Copied" : "Copy link"}
            </Button>
          </div>
        )}

        {(outputMode === "qr" || outputMode === "both") && (
          <div className="rounded-lg bg-zinc-950/60 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              QR code
            </p>
            {previewQr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewQr}
                alt="Campaign QR"
                className="mt-2 h-40 w-40 rounded-md bg-white p-2"
              />
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Generating QR…</p>
            )}
            {previewQr && (
              <a
                href={previewQr}
                download={`qr-${intent}-${eventSlug || "home"}.png`}
                className="mt-2.5 inline-flex h-7 items-center rounded-md bg-zinc-800 px-2.5 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
              >
                Download PNG
              </a>
            )}
          </div>
        )}

        <Button
          type="button"
          disabled={saving || !url}
          onClick={onSave}
          className="h-10 bg-amber-400 font-semibold text-zinc-950 hover:bg-amber-300"
        >
          {saving ? "Saving…" : "Save to list"}
        </Button>
      </div>
    </div>
  );
}

function DetailPanel({
  item,
  copied,
  copy,
  onBack,
  onDelete,
}: {
  item: SavedCampaign;
  copied: string | null;
  copy: (value: string, key: string) => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mt-5 rounded-xl bg-zinc-900/60">
      <div className="flex items-center gap-2 border-b border-zinc-800/60 px-3 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-8 gap-1 px-2 text-xs text-zinc-300"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
          {item.eventName ?? "Home"} · {item.purposeLabel}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-[11px] text-red-300 hover:text-red-200"
          onClick={() => {
            if (window.confirm("Remove this saved campaign from this device?")) onDelete();
          }}
        >
          Delete
        </Button>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="subtle" className="text-[10px] uppercase">
            {item.intent}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {item.outputMode === "both"
              ? "Link + QR"
              : item.outputMode === "qr"
                ? "QR"
                : "Link"}
          </Badge>
          <span className="text-[11px] text-zinc-500">
            Night {item.nightKey} · {formatWhen(item.createdAt)}
          </span>
        </div>

        {(item.outputMode === "link" || item.outputMode === "both") && (
          <div className="rounded-lg bg-zinc-950/60 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Link
            </p>
            <p className="mt-1.5 break-all font-mono text-[12px] text-zinc-200">{item.url}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2.5 h-7 text-[11px]"
              onClick={() => copy(item.url, "detail")}
            >
              {copied === "detail" ? "Copied" : "Copy link"}
            </Button>
          </div>
        )}

        {(item.outputMode === "qr" || item.outputMode === "both") && item.qrDataUrl && (
          <div className="rounded-lg bg-zinc-950/60 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              QR code
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.qrDataUrl}
              alt="Saved QR"
              className="mt-2 h-40 w-40 rounded-md bg-white p-2"
            />
            <a
              href={item.qrDataUrl}
              download={`qr-${item.src}.png`}
              className="mt-2.5 inline-flex h-7 items-center rounded-md bg-zinc-800 px-2.5 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
            >
              Download PNG
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SavedRow({ item, onOpen }: { item: SavedCampaign; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-xl bg-zinc-900/60 px-3.5 py-2.5 text-left transition-colors hover:bg-zinc-900/90 focus:outline-none"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-zinc-100">
            {item.eventName ?? "Home"} · {item.intent}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
            {item.purposeLabel}
            <span className="text-zinc-600"> · {item.src}</span>
          </p>
        </div>
        <Badge variant="subtle" className="shrink-0 px-1.5 py-0 text-[9px] uppercase">
          {item.outputMode === "both" ? "Link+QR" : item.outputMode}
        </Badge>
      </button>
    </li>
  );
}

function NightDrawer({
  nightKey,
  items,
  onOpen,
}: {
  nightKey: string;
  items: SavedCampaign[];
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-zinc-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left focus:outline-none"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100">{formatNight(nightKey)}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {items.length} campaign{items.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="text-zinc-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <ul className="flex flex-col gap-1.5 border-t border-zinc-800/60 px-2.5 pb-2.5 pt-2">
          {items.map((item) => (
            <SavedRow key={item.id} item={item} onOpen={() => onOpen(item.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      timeZone: "America/Toronto",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatNight(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const dt = new Date(Date.UTC(y, m - 1, d, 17));
  return dt.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
