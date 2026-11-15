/**
 * Where the sync and drift scripts read budgettracker from.
 *
 * Two readers over the same checkout (`SOURCE_DIR`):
 * - `workingTreeSource()`: the files as checked out, at HEAD. The sync scripts
 *   use it, so a sync takes whatever budgettracker is on and records that sha.
 * - `pinnedSource()`: the commit recorded in `prisma/.source-sha`, read from
 *   git objects. The drift test uses it, so it checks the tree against the
 *   commit it was synced from, whichever branch the checkout has open.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, SOURCE_DIR, sourceSha } from "./paths";

export interface SourceReader {
  /** Short sha the generated headers name. */
  sha: string;
  /** Human-readable origin, for error messages. */
  label: string;
  /** Whether `path` (relative to budgettracker's root, forward slashes) is a file. */
  isFile(path: string): boolean;
  /** The file's contents. Throws when it is absent. */
  read(path: string): string;
}

/** The checkout as it is on disk. */
export function workingTreeSource(sha = sourceSha()): SourceReader {
  return {
    sha,
    label: SOURCE_DIR,
    isFile: (path) => {
      const absolute = join(SOURCE_DIR, path);
      return existsSync(absolute) && statSync(absolute).isFile();
    },
    read: (path) => readFileSync(join(SOURCE_DIR, path), "utf8"),
  };
}

/** The sha this repo was last synced from, as `prisma/.source-sha` records it. */
export function pinnedSha(): string {
  return readFileSync(join(REPO_ROOT, "prisma", ".source-sha"), "utf8").trim();
}

const git = (args: string[]): string =>
  execFileSync("git", args, {
    cwd: SOURCE_DIR,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    // Captured rather than inherited: a missing commit is reported by the caller.
    stdio: ["ignore", "pipe", "pipe"],
  });

/** budgettracker at the pinned commit, read from git objects without touching the checkout. */
export function pinnedSource(sha = pinnedSha()): SourceReader {
  let files: Set<string>;
  try {
    files = new Set(git(["ls-tree", "-r", "--name-only", sha]).split("\n").filter(Boolean));
  } catch {
    throw new Error(
      `budgettracker@${sha} (from prisma/.source-sha) is not in ${SOURCE_DIR}. ` +
        "Run git fetch there, or set BUDGETTRACKER_DIR to a checkout that has it.",
    );
  }

  const cache = new Map<string, string>();
  return {
    sha,
    label: `${SOURCE_DIR} at ${sha}`,
    isFile: (path) => files.has(path),
    read: (path) => {
      if (!files.has(path)) throw new Error(`No ${path} in budgettracker@${sha}`);
      const cached = cache.get(path);
      if (cached !== undefined) return cached;
      const content = git(["show", `${sha}:${path}`]);
      cache.set(path, content);
      return content;
    },
  };
}

export interface HeadComparison {
  /** The checkout's HEAD, short. */
  head: string;
  /** Whether HEAD is the pinned commit itself. */
  matches: boolean;
}

/**
 * The checkout's HEAD against the pinned commit, compared as full shas so a
 * short sha of a different length still matches. `null` when either cannot be
 * resolved (not a git repo, or the commit was never fetched).
 */
export function compareHeadToPinned(sha = pinnedSha()): HeadComparison | null {
  try {
    const head = git(["rev-parse", "HEAD"]).trim();
    const pinned = git(["rev-parse", "--verify", `${sha}^{commit}`]).trim();
    return { head: git(["rev-parse", "--short", "HEAD"]).trim(), matches: head === pinned };
  } catch {
    return null;
  }
}
