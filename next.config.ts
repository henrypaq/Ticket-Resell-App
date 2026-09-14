import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't walk up to a stray lockfile in
  // the home directory.
  turbopack: { root: __dirname },

  // Ticket screenshots can be several MB; default server-action body limit is 1MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "9mb",
    },
  },

  /**
   * `/member` (full beta onboarding) and `/go` (the low-friction IG funnel)
   * were merged into one app. Both are printed on flyers and linked from QR
   * codes and the Instagram bio, so they redirect rather than 404. Query
   * strings — including the `?src=` acquisition tag the proxy reads — are
   * carried over by Next automatically.
   *
   * Temporary (307/308-style `permanent: false`) on purpose: a permanent
   * redirect gets cached by browsers indefinitely, and these paths may be
   * wanted again.
   */
  async redirects() {
    return [
      // Clean, unambiguous bio link for when sniffing isn't good enough:
      // `mcgilltickets.party/ig` reads fine in a profile and can't be
      // misattributed. The bare apex works too — see `looksLikeInstagram`.
      { source: "/ig", destination: "/?src=ig_bio", permanent: false },

      { source: "/member", destination: "/", permanent: false },
      { source: "/go", destination: "/", permanent: false },
      { source: "/go/buy", destination: "/buy", permanent: false },
      { source: "/go/sell", destination: "/sell", permanent: false },
      { source: "/go/done", destination: "/done", permanent: false },
      // Retired `(app)` routes — see src/_legacy/README.md. All of them, not
      // just the obvious ones: Phase 3 shipped shareable listing links
      // (`share_link_created`), so `/events/<id>` URLs are sitting in chat
      // histories nobody controls and must not dead-end on a 404.
      { source: "/home", destination: "/", permanent: false },
      { source: "/profile", destination: "/settings", permanent: false },
      { source: "/notifications", destination: "/settings", permanent: false },
      { source: "/tickets", destination: "/", permanent: false },
      { source: "/search", destination: "/", permanent: false },
      { source: "/events/:id", destination: "/", permanent: false },
      { source: "/u/:handle", destination: "/", permanent: false },
      { source: "/sell/request-event", destination: "/sell", permanent: false },
    ];
  },

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
