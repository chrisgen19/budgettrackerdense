/**
 * Fails when the generated schema or vendored logic no longer matches a fresh
 * sync from the budgettracker checkout. See `lib/drift.ts`.
 */
import { findDrift } from "./lib/drift";

function main(): void {
  const { sha, checked, problems } = findDrift();

  if (problems.length > 0) {
    process.stderr.write(`Drift detected:\n${problems.map((p) => `  - ${p}`).join("\n")}\n`);
    process.stderr.write("\nRun pnpm sync:schema && pnpm sync:vendor, then review the diff.\n");
    process.exit(1);
  }

  process.stdout.write(`No drift: ${checked} generated files match budgettracker@${sha}\n`);
}

main();
