/**
 * Fails when the generated schema or vendored logic no longer matches a fresh
 * sync from the budgettracker commit recorded in `prisma/.source-sha`. See
 * `lib/drift.ts`.
 *
 * Reads that commit from git, so the result does not depend on which branch
 * the checkout has open. When the checkout's HEAD is a different commit it
 * says so, without failing: re-syncing is a deliberate step, not a fix.
 */
import { findDrift } from "./lib/drift";
import { SOURCE_DIR } from "./lib/paths";
import { compareHeadToPinned, pinnedSource } from "./lib/source";

function main(): void {
  const source = pinnedSource();
  const { sha, checked, problems } = findDrift(undefined, undefined, source);

  if (problems.length > 0) {
    process.stderr.write(`Drift detected:\n${problems.map((p) => `  - ${p}`).join("\n")}\n`);
    process.stderr.write(
      "\nA generated file was edited, added or removed by hand. Restore it, or change the source\n" +
        "in budgettracker and run pnpm sync:schema && pnpm sync:vendor, then review the diff.\n",
    );
    process.exit(1);
  }

  process.stdout.write(`No drift: ${checked} generated files match budgettracker@${sha}\n`);

  const head = compareHeadToPinned(sha);
  if (head && !head.matches) {
    process.stdout.write(
      `Note: ${SOURCE_DIR} is at ${head.head}, not the pinned ${sha}. ` +
        "To take its changes, run pnpm sync:schema && pnpm sync:vendor here and review the diff.\n",
    );
  }
}

main();
