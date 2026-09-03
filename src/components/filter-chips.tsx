"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarIcon, CheckIcon, CloseIcon, PinIcon } from "./icons";
import { formatCad } from "@/lib/compliance/pricing";

/**
 * Real filters, driven by URL search params so results are server-rendered and
 * the state is shareable/back-button-safe. Every chip here changes what is
 * actually queried — see EventFilters in domains/events/data.ts.
 */
const PRICE_CEILINGS = [15, 25, 40, 60];

export function FilterChips({ tags, cities }: { tags: string[]; cities: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<"date" | "tag" | "price" | "city" | null>(null);

  const current = {
    date: params.get("date") ?? "",
    tag: params.get("tag") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    city: params.get("city") ?? "",
  };
  const activeCount = Object.values(current).filter(Boolean).length;

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setOpen(null);
    router.push(`${pathname}?${next.toString()}`);
  }

  function clearAll() {
    const next = new URLSearchParams(params.toString());
    for (const key of ["date", "tag", "maxPrice", "city"]) next.delete(key);
    setOpen(null);
    router.push(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  }

  const chip = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-[15px] transition-colors ${
      active ? "pill font-medium text-ink" : "pill-quiet text-muted"
    }`;

  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button
          type="button"
          onClick={() => setOpen(open === "city" ? null : "city")}
          aria-expanded={open === "city"}
          className={chip(true)}
        >
          <PinIcon className="h-[18px] w-[18px]" />
          {current.city || cities[0] || "Montreal"}
        </button>

        <button
          type="button"
          onClick={() => setOpen(open === "date" ? null : "date")}
          aria-expanded={open === "date"}
          aria-label="Filter by date"
          className={`${chip(Boolean(current.date))} ${current.date ? "" : "h-[42px] w-[42px] justify-center !px-0"}`}
        >
          <CalendarIcon className="h-[18px] w-[18px]" />
          {current.date && <span>{shortDate(current.date)}</span>}
        </button>

        <button
          type="button"
          onClick={() => setOpen(open === "tag" ? null : "tag")}
          aria-expanded={open === "tag"}
          className={chip(Boolean(current.tag))}
        >
          {current.tag || "Music"}
        </button>

        <button
          type="button"
          onClick={() => setOpen(open === "price" ? null : "price")}
          aria-expanded={open === "price"}
          className={chip(Boolean(current.maxPrice))}
        >
          {current.maxPrice ? `≤ ${formatCad(Number(current.maxPrice))}` : "Price"}
        </button>

        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className={`${chip(false)} gap-1`}>
            <CloseIcon className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {open === "city" && (
        <Panel>
          {(cities.length ? cities : ["Montreal"]).map((city) => (
            <Option
              key={city}
              selected={current.city === city || (!current.city && city === cities[0])}
              onClick={() => setParam("city", current.city === city ? null : city)}
            >
              {city}
            </Option>
          ))}
        </Panel>
      )}

      {open === "date" && (
        <Panel>
          <label className="flex items-center justify-between gap-3 px-1 py-1">
            <span className="text-[14px] text-muted">Pick a date</span>
            <input
              type="date"
              value={current.date}
              onChange={(e) => setParam("date", e.target.value || null)}
              className="pill bg-transparent px-3 py-2 text-[15px] text-ink outline-none"
            />
          </label>
          {current.date && (
            <Option selected={false} onClick={() => setParam("date", null)}>
              Any date
            </Option>
          )}
        </Panel>
      )}

      {open === "tag" && (
        <Panel>
          {tags.length === 0 && <p className="px-1 py-2 text-[14px] text-muted">No genres yet.</p>}
          {tags.map((tag) => (
            <Option
              key={tag}
              selected={current.tag === tag}
              onClick={() => setParam("tag", current.tag === tag ? null : tag)}
            >
              {tag}
            </Option>
          ))}
        </Panel>
      )}

      {open === "price" && (
        <Panel>
          {PRICE_CEILINGS.map((ceiling) => (
            <Option
              key={ceiling}
              selected={current.maxPrice === String(ceiling)}
              onClick={() =>
                setParam("maxPrice", current.maxPrice === String(ceiling) ? null : String(ceiling))
              }
            >
              Under {formatCad(ceiling)}
            </Option>
          ))}
        </Panel>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="surface mt-3 rounded-2xl p-2">{children}</div>;
}

function Option({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors ${
        selected ? "bg-white/10 font-medium text-ink" : "text-muted hover:bg-white/5"
      }`}
    >
      {children}
      {selected && <CheckIcon className="h-4 w-4 shrink-0" />}
    </button>
  );
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
