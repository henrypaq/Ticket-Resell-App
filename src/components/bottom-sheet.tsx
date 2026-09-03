"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";

/**
 * Shared slide-up sheet, portaled to document.body so it isn't clipped by any
 * parent's overflow/stacking context. Two tones: "dark" matches the rest of
 * the app (location); "light" is a deliberate white surface for the share
 * sheet, contrasting the dark-first UI on purpose, per request.
 *
 * The open/close animation is a plain CSS transform transition driven by
 * component state — not the View Transitions API used for page navigation
 * elsewhere. There's nothing async here to race or time out.
 */
export function BottomSheet({
  open,
  onClose,
  tone = "dark",
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  tone?: "dark" | "light";
  title?: string;
  children: React.ReactNode;
}) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  // Derived-state-from-props, computed during render rather than in an
  // effect (React's own recommended pattern for this): the sheet must be in
  // the DOM the instant `open` flips true, and the exit transition must start
  // the instant it flips false — an effect fires a render-cycle later than
  // this, which is what the double-rAF hack elsewhere in this codebase (see
  // transition-link.tsx's history) already burned time on once.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setRendered(true);
    else setVisible(false);
  }

  // The effect only ever sets state inside the rAF callback — deferred, not
  // synchronous in the effect body — so there's nothing here for the
  // set-state-in-effect rule to flag.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!rendered || typeof document === "undefined") return null;

  const light = tone === "light";

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        onClick={onClose}
        aria-hidden
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && !visible) setRendered(false);
        }}
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[28px] transition-transform duration-250 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        } ${light ? "border-t border-black/5 bg-white text-neutral-900" : "border-t border-hairline bg-card text-ink"}`}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-center pt-3">
          <span
            aria-hidden
            className={`h-1 w-9 rounded-full ${light ? "bg-black/15" : "bg-white/15"}`}
          />
        </div>

        {title && (
          <div className="flex items-center justify-between px-5 pt-3">
            <h2 className="text-[16px] font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                light ? "text-neutral-400" : "text-muted"
              }`}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="px-5 pb-2 pt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
