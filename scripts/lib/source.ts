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

const git = (args: string[], cwd: string = SOURCE_DIR): string =>
  execFileSync("git", args, {
    cwd,
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

/**
 * Where HEAD sits relative to the pinned commit. Only `ahead` has changes to
 * take: `behind` and `diverged` lack commits the pin has, so a sync from them
 * would undo what this app was synced to (a9639d0 against 202e6de lost DENSE).
 */
export type HeadRelation = "same" | "behind" | "ahead" | "diverged";

export interface HeadComparison {
  /** The checkout's HEAD, short. */
  head: string;
  /** Whether HEAD is the pinned commit itself. */
  matches: boolean;
  relation: HeadRelation;
}

/** Whether `ancestor` is reachable from `descendant`. `git merge-base --is-ancestor` answers by exit code. */
const isAncestor = (ancestor: string, descendant: string, cwd: string): boolean => {
  try {
    git(["merge-base", "--is-ancestor", ancestor, descendant], cwd);
    return true;
  } catch {
    return false;
  }
};

/**
 * The checkout's HEAD against the pinned commit, compared as full shas so a
 * short sha of a different length still matches. `null` when either cannot be
 * resolved (not a git repo, or the commit was never fetched).
 */
export function compareHeadToPinned(sha = pinnedSha(), dir: string = SOURCE_DIR): HeadComparison | null {
  try {
    const head = git(["rev-parse", "HEAD"], dir).trim();
    const pinned = git(["rev-parse", "--verify", `${sha}^{commit}`], dir).trim();
    const relation: HeadRelation =
      head === pinned
        ? "same"
        : isAncestor(head, pinned, dir)
          ? "behind"
          : isAncestor(pinned, head, dir)
            ? "ahead"
            : "diverged";
    return { head: git(["rev-parse", "--short", "HEAD"], dir).trim(), matches: head === pinned, relation };
  } catch {
    return null;
  }
}

/** The line `check:drift` prints about the checkout's HEAD, or `null` when there is nothing to say. */
export const driftNote = (comparison: HeadComparison | null, sha: string, dir: string = SOURCE_DIR): string | null => {
  if (!comparison || comparison.relation === "same") return null;
  const at = `Note: ${dir} is at ${comparison.head}`;

  switch (comparison.relation) {
    case "ahead":
      return `${at}, ahead of the pinned ${sha}. To take its changes, run pnpm sync:schema && pnpm sync:vendor here and review the diff.`;
    case "behind":
      return `${at}, behind the pinned ${sha}: it lacks commits this app was synced from. Do not sync from it; check out budgettracker main first.`;
    case "diverged":
      return `${at}, which has diverged from the pinned ${sha}: it lacks commits this app was synced from. Do not sync from it; check out budgettracker main first.`;
  }
};
