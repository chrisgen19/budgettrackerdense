import type { NextConfig } from "next";

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
};

export default nextConfig;
