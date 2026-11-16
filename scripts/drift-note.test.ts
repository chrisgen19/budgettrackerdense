import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compareHeadToPinned, driftNote } from "./lib/source";

// A throwaway checkout standing in for ../budgettracker:
//   A -- B (pinned) -- D
//    \
//     C (a branch cut before the pin, like design/redesign-2026 at a9639d0)
let dir: string;
const shas: Record<"A" | "B" | "C" | "D", string> = { A: "", B: "", C: "", D: "" };

const git = (...args: string[]): string =>
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
    cwd: dir,
    encoding: "utf8",
  }).trim();

const commit = (name: keyof typeof shas): void => {
  writeFileSync(join(dir, `${name}.txt`), name);
  git("add", ".");
  git("commit", "-q", "-m", name);
  shas[name] = git("rev-parse", "--short", "HEAD");
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "drift-note-"));
  git("init", "-q", "-b", "main");
  commit("A");
  commit("B");
  commit("D");
  git("checkout", "-q", "-b", "side", shas.A);
  commit("C");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const at = (ref: string) => {
  git("checkout", "-q", ref);
  return compareHeadToPinned(shas.B, dir);
};

describe("compareHeadToPinned relation", () => {
  it("is same when HEAD is the pinned commit", () => {
    expect(at(shas.B)?.relation).toBe("same");
  });

  it("is behind when HEAD is an ancestor of the pinned commit", () => {
    expect(at(shas.A)?.relation).toBe("behind");
  });

  it("is ahead when the pinned commit is an ancestor of HEAD", () => {
    expect(at(shas.D)?.relation).toBe("ahead");
  });

  it("is diverged when neither contains the other", () => {
    expect(at(shas.C)?.relation).toBe("diverged");
  });

  // CodeRabbit on PR 7: head is shortened from the commit the relation was
  // computed for, not from a second read of HEAD that a checkout could change.
  it("names the same commit it classified", () => {
    for (const name of ["A", "B", "C", "D"] as const) {
      expect(at(shas[name])?.head).toBe(shas[name]);
    }
  });
});

describe("driftNote", () => {
  it("says nothing when HEAD is the pinned commit", () => {
    expect(driftNote(at(shas.B), shas.B, dir)).toBeNull();
  });

  it("calls an older checkout behind and warns against syncing it", () => {
    const note = driftNote(at(shas.A), shas.B, dir) ?? "";
    expect(note).toMatch(/behind the pinned/);
    expect(note).toMatch(/do not sync/i);
    expect(note).not.toMatch(/to take its changes/i);
  });

  it("offers the sync only when the checkout is ahead", () => {
    expect(driftNote(at(shas.D), shas.B, dir)).toMatch(/ahead of the pinned .*pnpm sync:schema && pnpm sync:vendor/);
  });

  it("warns that a diverged checkout would drop pinned commits", () => {
    const note = driftNote(at(shas.C), shas.B, dir) ?? "";
    expect(note).toMatch(/diverged from the pinned/);
    expect(note).toMatch(/do not sync/i);
  });

  it("says nothing when the comparison is unavailable", () => {
    expect(driftNote(null, shas.B, dir)).toBeNull();
  });
});

// CodeRabbit on PR 7: in a shallow clone the boundary commits have no parents,
// so with D checked out at depth 1 and the pinned B fetched separately at depth
// 1, both ancestry checks fail although D is a child of B.
describe("a shallow checkout", () => {
  let shallow: string;

  beforeAll(() => {
    git("checkout", "-q", "main");
    shallow = mkdtempSync(join(tmpdir(), "drift-note-shallow-"));
    const inShallow = (...args: string[]) =>
      execFileSync("git", ["-c", "protocol.file.allow=always", ...args], { cwd: shallow, encoding: "utf8" });
    inShallow("clone", "-q", "--depth", "1", "--branch", "main", `file://${dir}`, ".");
    inShallow("fetch", "-q", "--depth", "1", "origin", git("rev-parse", shas.B));
  });

  afterAll(() => rmSync(shallow, { recursive: true, force: true }));

  it("reports unknown rather than diverged when the history cannot tell", () => {
    expect(compareHeadToPinned(shas.B, shallow)?.relation).toBe("unknown");
  });

  it("asks for the full history instead of calling it diverged", () => {
    const note = driftNote(compareHeadToPinned(shas.B, shallow), shas.B, shallow) ?? "";
    expect(note).toMatch(/history is incomplete/);
    expect(note).toMatch(/git fetch --unshallow/);
    expect(note).not.toMatch(/diverged/);
  });
});
