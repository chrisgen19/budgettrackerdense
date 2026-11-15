import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Server-side modules import "server-only", whose default entry throws
      // outside a React Server Component. Resolve it the way the server build
      // does, to the package's own empty module.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
      "@bt": fileURLToPath(new URL("./src/vendor/bt", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Node by default; component tests opt in per file with
    // `// @vitest-environment jsdom` on the first line.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    globals: false,
  },
});
