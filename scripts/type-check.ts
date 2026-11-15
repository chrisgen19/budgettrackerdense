/**
 * Two type-check passes, because the two repos do not agree on one flag.
 *
 * 1. `tsconfig.build.json`, which drops `noUncheckedIndexedAccess`: checks
 *    everything, vendored files included, so a copy that no longer fits this
 *    app's Prisma client or config fails here. This is also the config
 *    `next build` uses.
 * 2. `tsconfig.json`, which keeps the flag: holds this app's own code to it.
 *    Diagnostics under `src/vendor/bt` are dropped, since budgettracker's
 *    source is written without the flag and must never be edited here.
 */
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "./lib/paths";
import { VENDOR_DIR } from "./lib/vendor-sync";

/** Run tsc and return its diagnostic lines, or exit on a failure that is not a diagnostic. */
function typeCheck(project: string): string[] {
  const result = spawnSync("pnpm", ["exec", "tsc", "--noEmit", "-p", project], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });

  if (result.error) throw result.error;
  if (result.stderr) process.stderr.write(result.stderr);

  return result.stdout.split("\n");
}

/** Diagnostics for one file and its indented continuation lines. */
function withoutVendor(lines: string[]): string[] {
  let skipping = false;
  return lines.filter((line) => {
    if (/^\S/.test(line)) skipping = line.startsWith(VENDOR_DIR);
    return !skipping;
  });
}

function main(): void {
  let failed = false;

  for (const [project, filter] of [
    ["tsconfig.build.json", (lines: string[]) => lines],
    ["tsconfig.json", withoutVendor],
  ] as const) {
    const problems = filter(typeCheck(project)).filter((line) => line.trim().length > 0);
    if (problems.length === 0) continue;

    failed = true;
    process.stderr.write(`${project}:\n${problems.join("\n")}\n`);
  }

  if (failed) process.exit(1);
  process.stdout.write("Type-check clean: vendored copy fits, app code holds the stricter flag.\n");
}

main();
