/** Shared paths and source metadata for the sync and drift scripts. */
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The budgettracker checkout this app copies its schema and logic from. */
export const SOURCE_DIR = resolve(REPO_ROOT, process.env.BUDGETTRACKER_DIR ?? "../budgettracker");

/** One generated file: a repo-relative path and the exact bytes that belong there. */
export interface GeneratedFile {
  /** Path relative to the repo root, with forward slashes. */
  path: string;
  content: string;
}

/** Short commit sha of the source checkout, or "unknown" if it is not a git repo. */
export function sourceSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: SOURCE_DIR,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}
