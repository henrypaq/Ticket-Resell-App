const STAR_COUNT = 70;

/**
 * Deterministic scatter (not Math.random()) so server- and client-rendered
 * markup match exactly — random values generated during render would cause a
 * hydration mismatch the moment this streams from the server.
 */
function buildStars() {
  const stars: { x: number; y: number; size: number; opacity: number }[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const x = (i * 53.73 + (i % 7) * 11) % 100;
    const y = (i * 29.17 + (i % 5) * 17) % 100;
    const size = 1 + (i % 3 === 0 ? 1 : 0); // mostly 1px, some 2px
    const opacity = 0.15 + ((i * 13) % 55) / 100; // 0.15–0.7
    stars.push({ x, y, size, opacity });
  }
  return stars;
}

const STARS = buildStars();

/** Subtle, static star scatter behind the waitlist + beta shell pages. */
export function Starfield() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      {STARS.map((s, i) => (
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
    </div>
  );
}
