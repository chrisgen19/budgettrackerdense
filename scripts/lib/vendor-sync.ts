/**
 * The vendor transform: budgettracker's read/write logic to `src/vendor/bt/`.
 *
 * Starts from the entry files this app needs, follows their internal imports
 * transitively, and rewrites `@/` specifiers to `@bt/` so the copy resolves
 * against itself. Pure, so `sync-vendor.ts` writes the result and
 * `check-drift.ts` compares it in memory.
 *
 * budgettracker owns every rule in these files. The only hand-written piece is
 * the `lib/prisma` shim, which points the copied modules at this app's client.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import ts from "typescript";
import { type GeneratedFile, SOURCE_DIR, sourceSha } from "./paths";

/** Where the copy lives, relative to the repo root. */
export const VENDOR_DIR = "src/vendor/bt";

/** Files this app imports directly. Everything else arrives by following imports. */
const ENTRY_FILES = [
  "lib/budget-queries.ts",
  "lib/budget-plans.ts",
  "lib/credit-account-queries.ts",
  "lib/transaction-writes.ts",
  "lib/period-progress.ts",
  "types/index.ts",
] as const;

/**
 * Source paths that are never copied.
 *
 * `lib/prisma.ts` constructs budgettracker's own client against the owner role;
 * this app replaces it with a shim onto `@/server/db`.
 */
const SKIPPED_SOURCES = new Set(["lib/prisma.ts"]);

const SHIM_SOURCES: Record<string, string> = {
  "lib/prisma.ts":
    "// GENERATED shim: budgettracker modules that import the shared client get this app's client.\n" +
    'export { prisma } from "@/server/db";\n',
};

const SOURCE_SRC = join(SOURCE_DIR, "src");

/** Resolve one import specifier to a path under budgettracker's `src/`, or null if external. */
function resolveSpecifier(specifier: string, fromSrcPath: string): string | null {
  let candidate: string;
  if (specifier.startsWith("@/")) {
    candidate = specifier.slice(2);
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    candidate = posix.normalize(posix.join(posix.dirname(fromSrcPath), specifier));
  } else {
    return null;
  }

  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx", ""]) {
    const withSuffix = `${candidate}${suffix}`;
    const absolute = join(SOURCE_SRC, withSuffix);
    if (existsSync(absolute) && statSync(absolute).isFile()) return withSuffix;
  }
  return null;
}

/** Rewrite `@/x` to `@bt/x` in import, export-from and dynamic-import specifiers. */
function rewriteSpecifiers(code: string): string {
  return code.replace(
    /((?:\bfrom|\bimport|\brequire)\s*\(?\s*)(["'])@\//g,
    (_match, lead: string, quote: string) => `${lead}${quote}@bt/`,
  );
}

function headerFor(sourcePath: string, sha: string): string {
  return `// GENERATED from budgettracker@${sha}:src/${sourcePath}. Do not edit. Run pnpm sync:vendor.\n`;
}

/** The GENERATED marker every file under the vendor directory must start with. */
export const GENERATED_PREFIX = "// GENERATED";

export interface VendorManifestEntry {
  /** Path under `src/vendor/bt/`. */
  target: string;
  /** Path under budgettracker's `src/`, or "shim" for the hand-written seam. */
  source: string;
  /** SHA-256 of the transformed content. */
  sha256: string;
}

export interface VendorPlan {
  sha: string;
  files: GeneratedFile[];
  /** Vendor-relative paths of every file the plan produces, MANIFEST.json included. */
  targets: Set<string>;
}

export function planVendorSync(sha = sourceSha()): VendorPlan {
  if (!existsSync(SOURCE_SRC)) {
    throw new Error(
      `No sources at ${SOURCE_SRC}. Set BUDGETTRACKER_DIR to the budgettracker checkout.`,
    );
  }

  const copied = new Map<string, string>();
  const queue: string[] = [...ENTRY_FILES];
  const seen = new Set<string>(queue);
  const missing: string[] = [];

  while (queue.length > 0) {
    const srcPath = queue.shift() as string;
    if (SKIPPED_SOURCES.has(srcPath)) continue;
    if (srcPath.endsWith(".test.ts") || srcPath.endsWith(".test.tsx")) continue;

    const absolute = join(SOURCE_SRC, srcPath);
    if (!existsSync(absolute)) {
      missing.push(srcPath);
      continue;
    }

    const code = readFileSync(absolute, "utf8");
    copied.set(srcPath, code);

    const preprocessed = ts.preProcessFile(code, true, true);
    for (const { fileName } of preprocessed.importedFiles) {
      const resolved = resolveSpecifier(fileName, srcPath);
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);
      queue.push(resolved);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Entry files not found in budgettracker: ${missing.join(", ")}`);
  }

  const files: GeneratedFile[] = [];
  const manifest: VendorManifestEntry[] = [];

  const add = (target: string, source: string, content: string): void => {
    files.push({ path: posix.join(VENDOR_DIR, target), content });
    manifest.push({
      target,
      source,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  };

  for (const [srcPath, code] of [...copied].sort(([a], [b]) => (a < b ? -1 : 1))) {
    add(srcPath, `src/${srcPath}`, headerFor(srcPath, sha) + rewriteSpecifiers(code));
  }

  for (const [srcPath, content] of Object.entries(SHIM_SOURCES)) {
    if (!seen.has(srcPath)) continue;
    add(srcPath, "shim", content);
  }

  manifest.sort((a, b) => (a.target < b.target ? -1 : 1));
  const manifestJson = `${JSON.stringify({ source: `budgettracker@${sha}`, files: manifest }, null, 2)}\n`;
  files.push({ path: posix.join(VENDOR_DIR, "MANIFEST.json"), content: manifestJson });

  return {
    sha,
    files,
    targets: new Set(files.map((file) => posix.relative(VENDOR_DIR, file.path))),
  };
}

/** Every file currently under the vendor directory, as vendor-relative posix paths. */
export function existingVendorFiles(repoRoot: string): string[] {
  const root = join(repoRoot, VENDOR_DIR);
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) found.push(relative(root, absolute).split(sep).join("/"));
    }
  };
  if (!existsSync(root)) return [];
  walk(root);
  return found.sort();
}
