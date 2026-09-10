"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRY_CODES, countryByIso2 } from "@/lib/country-codes";

/**
 * Custom combobox replacing a native `<select>` for the country-code picker
 * — a native select's open popup can't be restyled to match the app's dark
 * theme (browser-native chrome), so this renders its own dark, rounded
 * dropdown instead.
 */
export function CountryCodeSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (iso2: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = countryByIso2(value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-full items-center gap-1.5 px-4 py-4 text-[16px] text-ink outline-none"
      >
        <span aria-hidden>{current.flag}</span>
        <span className="text-muted">+{current.dial}</span>
        <span
          aria-hidden
          className={`text-[9px] text-muted transition-transform duration-150 ${open ? "-rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Country code"
          className="surface absolute left-0 top-[calc(100%+8px)] z-50 max-h-64 w-60 overflow-y-auto rounded-2xl p-1.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]"
        >
          {COUNTRY_CODES.map((c) => (
            <button
              key={c.iso2}
              type="button"
              role="option"
              aria-selected={c.iso2 === value}
              onClick={() => {
                onChange(c.iso2);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors ${
                c.iso2 === value ? "bg-[#6ee1ff]/10 text-ink" : "text-ink hover:bg-white/5"
              }`}
            >
              <span aria-hidden>{c.flag}</span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="shrink-0 text-muted">+{c.dial}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
