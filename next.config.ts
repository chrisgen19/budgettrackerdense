import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * One origin, no framing, no third-party anything. `next/font` self-hosts IBM
 * Plex, so Google Fonts needs no exception. `'unsafe-inline'` for scripts covers
 * Next's hydration bootstrap, which carries no nonce while Cache Components are
 * off; `'unsafe-eval'` is dev only, for Turbopack's refresh runtime.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Cache Components (and its Partial Prefetching) are deliberately off.
  // Every page here is session-gated and reads live Postgres per user, so there
  // is no meaningful static shell to prerender, and `use cache` is in-memory and
  // per-instance, which is wrong for exact money figures. See the decision note
  // in docs/plans/00-overview.md.
  typescript: {
    // The vendored budgettracker copy under src/vendor/bt does not compile with
    // `noUncheckedIndexedAccess`, which tsconfig.json sets for this app's own
    // code. This config drops that one flag; `pnpm type-check` runs both.
    tsconfigPath: "tsconfig.build.json",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
