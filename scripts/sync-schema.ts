/**
 * Copies budgettracker's Prisma schema into this repo and regenerates the client.
 *
 * budgettracker owns the schema and every migration. This app only ever reads
 * the file, so `prisma/schema.prisma` here is generated output: never edit it,
 * and never run `prisma migrate`, `db push` or `db pull` from this repo.
 */
import { execFileSync } from "node:child_process";
import { planSchemaSync } from "./lib/schema-sync";
import { REPO_ROOT } from "./lib/paths";
import { workingTreeSource } from "./lib/source";
import { writeGenerated } from "./lib/write-files";

function main(): void {
  const source = workingTreeSource();
  writeGenerated(planSchemaSync(source));
  process.stdout.write(`Synced prisma/schema.prisma from budgettracker@${source.sha}\n`);

  execFileSync("pnpm", ["exec", "prisma", "generate"], { cwd: REPO_ROOT, stdio: "inherit" });
}

main();
