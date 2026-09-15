"use client";

import { useMemo, useState } from "react";
import {
  URL_ACQUISITION_CHANNELS,
  ACQUISITION_CHANNEL_LABELS,
  buildCampaignLink,
  parseLastSrc,
  type AcquisitionChannel,
} from "@/lib/beta-acquisition";
import { Button } from "@/components/ui/button";

type EventOption = { slug: string; name: string };

const PRESET_SRCS: { value: string; label: string }[] = [
  ...URL_ACQUISITION_CHANNELS.map((c) => ({
    value: c,
    label: ACQUISITION_CHANNEL_LABELS[c as AcquisitionChannel],
  })),
  { value: "ig_story", label: "Instagram story (custom)" },
  { value: "ig_reel", label: "Instagram reel (custom)" },
  { value: "share_link", label: "Share link (custom)" },
];

export function LinksGenerator({
  events,
  origin,
}: {
  events: EventOption[];
  origin: string;
}) {
  const [intent, setIntent] = useState<"buy" | "sell" | "home">("buy");
  const [eventSlug, setEventSlug] = useState(events[0]?.slug ?? "");
  const [preset, setPreset] = useState(PRESET_SRCS[0]?.value ?? "ig_bio");
  const [customSrc, setCustomSrc] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const src =
    preset === "custom"
      ? parseLastSrc(customSrc)
      : preset === "ig_story" || preset === "ig_reel" || preset === "share_link"
        ? parseLastSrc(customSrc.trim() || `${preset}_${eventSlug || "event"}`.replace(/-/g, "_"))
        : parseLastSrc(preset);

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

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy this link:", value);
    }
  }

  const buyUrl = buildCampaignLink({
    intent: "buy",
    eventSlug,
    src,
    origin,
  });
  const sellUrl = buildCampaignLink({
    intent: "sell",
    eventSlug,
    src,
    origin,
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl bg-zinc-900/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Build a link</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Short URLs for Instagram. The <code className="text-zinc-300">src</code> tag shows up on
          the lead as “Came from.”
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Intent
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value as "buy" | "sell" | "home")}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100"
            >
              <option value="buy">Buyer — open buy flow</option>
              <option value="sell">Seller — open sell flow</option>
              <option value="home">Home / landing</option>
            </select>
          </label>

          {intent !== "home" && (
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Event
              <select
                value={eventSlug}
                onChange={(e) => setEventSlug(e.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100"
              >
                {events.map((ev) => (
                  <option key={ev.slug} value={ev.slug}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Source tag
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-100"
            >
              {PRESET_SRCS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom tag…</option>
            </select>
          </label>

          {(preset === "custom" ||
            preset === "ig_story" ||
            preset === "ig_reel" ||
            preset === "share_link") && (
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Custom src (letters, numbers, _ -)
              <input
                value={customSrc}
                onChange={(e) => setCustomSrc(e.target.value)}
                placeholder={
                  preset === "custom" ? "ig_story_cafe_0915" : `${preset}_${eventSlug || "event"}`
                }
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 font-mono text-sm text-zinc-100"
              />
            </label>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-3">
          <p className="break-all font-mono text-[12px] text-zinc-200">{url}</p>
          <Button
            type="button"
            size="sm"
            className="mt-3 h-8"
            onClick={() => copy(url, "main")}
          >
            {copied === "main" ? "Copied" : "Copy link"}
          </Button>
        </div>
      </section>

      {eventSlug && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-100">Quick pair for this event</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Same source tag — one for buyers, one for sellers.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            <li className="rounded-lg bg-zinc-900/60 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Buy</p>
              <p className="mt-1 break-all font-mono text-[11px] text-zinc-300">{buyUrl}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-[11px]"
                onClick={() => copy(buyUrl, "buy")}
              >
                {copied === "buy" ? "Copied" : "Copy buy"}
              </Button>
            </li>
            <li className="rounded-lg bg-zinc-900/60 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Sell</p>
              <p className="mt-1 break-all font-mono text-[11px] text-zinc-300">{sellUrl}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-[11px]"
                onClick={() => copy(sellUrl, "sell")}
              >
                {copied === "sell" ? "Copied" : "Copy sell"}
              </Button>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
