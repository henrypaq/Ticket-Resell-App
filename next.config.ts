import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't walk up to a stray lockfile in
  // the home directory.
  turbopack: { root: __dirname },

  async headers() {
    // Baseline security headers (SECURITY.md § API & infrastructure hardening).
    // CSP is intentionally omitted here until the Phase 2 payment embed (Stripe)
    // is known — shipping a policy now that gets loosened later is worse than
    // adding it once with the real allow-list.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
