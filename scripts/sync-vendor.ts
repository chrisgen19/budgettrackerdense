/**
 * Regenerates `src/vendor/bt/` from budgettracker's `src/`.
 *
 * Never edit the output. Change the rule in budgettracker, then run this.
 */
import { rmSync } from "node:fs";
import { join, posix } from "node:path";
import { REPO_ROOT } from "./lib/paths";
import { VENDOR_DIR, existingVendorFiles, planVendorSync } from "./lib/vendor-sync";
import { writeGenerated } from "./lib/write-files";

function main(): void {
  const before = existingVendorFiles(REPO_ROOT);
  const plan = planVendorSync();
  writeGenerated(plan.files);

  for (const file of before) {
    if (plan.targets.has(file)) continue;
    rmSync(join(REPO_ROOT, VENDOR_DIR, file));
    process.stdout.write(`Removed stale ${posix.join(VENDOR_DIR, file)}\n`);
  }

  process.stdout.write(`Synced ${plan.files.length} files into ${VENDOR_DIR} from ${plan.sha}\n`);
}

main();
