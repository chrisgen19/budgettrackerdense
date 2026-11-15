import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated copies. budgettracker lints these in its own config; linting them
    // here would only report rule differences in code this repo must not edit.
    "src/vendor/bt/**",
    "prisma/**",
  ]),
]);

export default eslintConfig;
