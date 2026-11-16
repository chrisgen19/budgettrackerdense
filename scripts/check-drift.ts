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
import { compareHeadToPinned, driftNote, pinnedSource } from "./lib/source";

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

  // Only a checkout ahead of the pin has changes to take; one behind or
  // diverged would undo the pin, so the note says which it is.
  const note = driftNote(compareHeadToPinned(sha), sha);
  if (note) process.stdout.write(`${note}\n`);
}

main();
