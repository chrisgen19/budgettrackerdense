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
