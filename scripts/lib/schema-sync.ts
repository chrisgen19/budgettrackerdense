/**
 * The schema transform: budgettracker's `prisma/schema.prisma` to this repo's generated copy.
 *
 * Pure so `sync-schema.ts` can write it and `check-drift.ts` can compare it in memory.
 */
import type { GeneratedFile } from "./paths";
import { type SourceReader, workingTreeSource } from "./source";

const SOURCE_SCHEMA = "prisma/schema.prisma";

export function planSchemaSync(source: SourceReader = workingTreeSource()): GeneratedFile[] {
  if (!source.isFile(SOURCE_SCHEMA)) {
    throw new Error(
      `No schema at ${SOURCE_SCHEMA} in ${source.label}. Set BUDGETTRACKER_DIR to the budgettracker checkout.`,
    );
  }

  const { sha } = source;
  const header = `// GENERATED from budgettracker@${sha}. Do not edit. Run pnpm sync:schema.\n`;

  return [
    { path: "prisma/schema.prisma", content: header + source.read(SOURCE_SCHEMA) },
    { path: "prisma/.source-sha", content: `${sha}\n` },
  ];
}
