"use client";

import { Children, useRef, useState } from "react";

/**
 * Horizontal snap carousel with dot pagination, not arrows (STYLE.md).
 */
export function FeaturedCarousel({ children }: { children: React.ReactNode }) {
  const slides = Children.toArray(children);
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index !== active) setActive(index);
  }

  return (
    <div>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto"
      >
        {slides.map((slide, i) => (
          <div key={i} className="w-full shrink-0 snap-start">
            {slide}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden>
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-[3px] rounded-full transition-all ${
                i === active ? "w-6 bg-ink" : "w-4 bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
