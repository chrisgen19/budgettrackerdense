/**
 * The schema transform: budgettracker's `prisma/schema.prisma` to this repo's generated copy.
 *
 * Pure so `sync-schema.ts` can write it and `check-drift.ts` can compare it in memory.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type GeneratedFile, SOURCE_DIR, sourceSha } from "./paths";

const SOURCE_SCHEMA = join(SOURCE_DIR, "prisma", "schema.prisma");

export function planSchemaSync(sha = sourceSha()): GeneratedFile[] {
  if (!existsSync(SOURCE_SCHEMA)) {
    throw new Error(
      `No schema at ${SOURCE_SCHEMA}. Set BUDGETTRACKER_DIR to the budgettracker checkout.`,
    );
  }

  const header = `// GENERATED from budgettracker@${sha}. Do not edit. Run pnpm sync:schema.\n`;

  return [
    { path: "prisma/schema.prisma", content: header + readFileSync(SOURCE_SCHEMA, "utf8") },
    { path: "prisma/.source-sha", content: `${sha}\n` },
  ];
}
