/**
 * Drift detection: does the tree on disk still match a fresh sync from
 * budgettracker?
 *
 * A difference means one of two things. Either budgettracker moved, and the
 * answer is to re-sync and review the diff, or a generated file was edited
 * here, which is never the answer: change the source in budgettracker instead.
 */
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { type GeneratedFile, REPO_ROOT } from "./paths";
import { planSchemaSync } from "./schema-sync";
import { type SourceReader, workingTreeSource } from "./source";
import { GENERATED_PREFIX, VENDOR_DIR, existingVendorFiles, planVendorSync } from "./vendor-sync";

const MANIFEST = posix.join(VENDOR_DIR, "MANIFEST.json");

/** Reads a repo-relative file, throwing if it is absent. Injected so tests can fake the tree. */
export type ReadRepoFile = (repoRelativePath: string) => string;

const readFromDisk: ReadRepoFile = (path) => readFileSync(join(REPO_ROOT, path), "utf8");

export interface DriftReport {
  sha: string;
  /** How many generated files were checked. */
  checked: number;
  /** One line per problem, empty when the tree matches. */
  problems: string[];
}

/** Compare what a fresh sync would write against what the tree holds. */
function compare(files: GeneratedFile[], read: ReadRepoFile): string[] {
  const problems: string[] = [];
  for (const file of files) {
    let onDisk: string;
    try {
      onDisk = read(file.path);
    } catch {
      problems.push(`${file.path}: missing, a fresh sync would create it`);
      continue;
    }
    if (onDisk !== file.content) problems.push(`${file.path}: differs from a fresh sync`);
  }
  return problems;
}

/** Every vendored file must be generated output that a fresh sync still produces. */
function auditVendorDir(targets: Set<string>, read: ReadRepoFile, present: string[]): string[] {
  const problems: string[] = [];
  for (const file of present) {
    const path = posix.join(VENDOR_DIR, file);
    if (!targets.has(file)) {
      problems.push(`${path}: not produced by a sync (hand-added or stale)`);
      continue;
    }
    if (path === MANIFEST) continue;
    if (!read(path).startsWith(GENERATED_PREFIX)) problems.push(`${path}: no GENERATED header`);
  }
  return problems;
}

/**
 * Compares the tree with a fresh sync from `source`. The default is the
 * checkout's HEAD, which also catches budgettracker having moved on; pass
 * `pinnedSource()` to check only that the tree matches the commit it records.
 */
export function findDrift(
  read: ReadRepoFile = readFromDisk,
  present: string[] = existingVendorFiles(REPO_ROOT),
  source: SourceReader = workingTreeSource(),
): DriftReport {
  const schema = planSchemaSync(source);
  const vendor = planVendorSync(source);

  return {
    sha: vendor.sha,
    checked: schema.length + vendor.files.length,
    problems: [
      ...compare(schema, read),
      ...compare(vendor.files, read),
      ...auditVendorDir(vendor.targets, read, present),
    ],
  };
}
