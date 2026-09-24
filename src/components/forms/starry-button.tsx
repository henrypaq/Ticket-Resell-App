/**
 * Sell CTA — sleek hairline border, transparent fill with a denser star
 * scatter than the page backdrop so the button reads as a starfield window.
 */
const BUTTON_STAR_COUNT = 48;

function buildButtonStars() {
  const stars: { x: number; y: number; size: number; opacity: number }[] = [];
  for (let i = 0; i < BUTTON_STAR_COUNT; i++) {
    const x = (i * 41.37 + (i % 9) * 7.3) % 100;
    const y = (i * 23.91 + (i % 6) * 13.1) % 100;
    const size = i % 5 === 0 ? 2 : 1;
    const opacity = 0.28 + ((i * 17) % 55) / 100; // denser / brighter than page
    stars.push({ x, y, size, opacity });
  }
  return stars;
}

const BUTTON_STARS = buildButtonStars();

export const STARRY_SELL_BUTTON_CLASS =
  "font-ui relative flex min-h-[58px] items-center justify-center overflow-hidden rounded-[14px] border border-white/35 bg-transparent px-8 text-[16px] font-semibold tracking-tight text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-[border-color,background-color] duration-200 hover:border-white/55 hover:bg-white/[0.03] active:bg-white/[0.05]";

export function StarryButtonStars() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {BUTTON_STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
          }}
        />
      ))}
    </span>
  );
}
