/**
 * Copies budgettracker's Prisma schema into this repo and regenerates the client.
 *
 * budgettracker owns the schema and every migration. This app only ever reads
 * the file, so `prisma/schema.prisma` here is generated output: never edit it,
 * and never run `prisma migrate`, `db push` or `db pull` from this repo.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = resolve(REPO_ROOT, process.env.BUDGETTRACKER_DIR ?? "../budgettracker");
const SOURCE_SCHEMA = join(SOURCE_DIR, "prisma", "schema.prisma");
const TARGET_SCHEMA = join(REPO_ROOT, "prisma", "schema.prisma");
const TARGET_SHA = join(REPO_ROOT, "prisma", ".source-sha");

/** Short commit sha of the source checkout, or "unknown" if it is not a git repo. */
function sourceSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: SOURCE_DIR,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function main(): void {
  if (!existsSync(SOURCE_SCHEMA)) {
    throw new Error(
      `No schema at ${SOURCE_SCHEMA}. Set BUDGETTRACKER_DIR to the budgettracker checkout.`,
    );
  }

  const sha = sourceSha();
  const header = `// GENERATED from budgettracker@${sha}. Do not edit. Run pnpm sync:schema.\n`;
  const schema = readFileSync(SOURCE_SCHEMA, "utf8");

  mkdirSync(dirname(TARGET_SCHEMA), { recursive: true });
  writeFileSync(TARGET_SCHEMA, header + schema);
  writeFileSync(TARGET_SHA, `${sha}\n`);

  process.stdout.write(`Synced prisma/schema.prisma from budgettracker@${sha}\n`);

  execFileSync("pnpm", ["exec", "prisma", "generate"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}

main();
