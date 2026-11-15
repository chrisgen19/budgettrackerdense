import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (and its Partial Prefetching) are deliberately off.
  // Every page here is session-gated and reads live Postgres per user, so there
  // is no meaningful static shell to prerender, and `use cache` is in-memory and
  // per-instance, which is wrong for exact money figures. See the decision note
  // in docs/plans/00-overview.md.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
