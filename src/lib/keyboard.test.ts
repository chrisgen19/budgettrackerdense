import { describe, expect, it } from "vitest";
import {
  SEQUENCE_TIMEOUT_MS,
  SHORTCUTS,
  type SequenceState,
  groupedShortcuts,
  isTypingTarget,
  matchKey,
} from "./keyboard";

const NOW = 1_000_000;

/** Drives the matcher over a list of [key, timeOffset] pairs. */
function press(keys: [string, number][]) {
  let state: SequenceState | null = null;
  const results = keys.map(([key, offset]) => {
    const next = matchKey(key, state, NOW + offset);
    state = next.state;
    return next.result;
  });

  return results;
}

describe("matchKey", () => {
  it("holds `g` then resolves the second key", () => {
    const [first, second] = press([
      ["g", 0],
      ["o", 200],
    ]);

    expect(first).toEqual({ status: "pending", prefix: "g" });
    expect(second).toMatchObject({
      status: "match",
      shortcut: { action: { kind: "navigate", href: "/overview" } },
    });
  });

  it("resolves every documented g-sequence", () => {
    const expected = [
      ["o", "/overview"],
      ["l", "/ledger"],
      ["r", "/reports"],
      ["c", "/cards"],
      ["u", "/budgets"],
      ["b", "/bills"],
      ["t", "/labels"],
    ] as const;

    for (const [key, href] of expected) {
      const [, result] = press([
        ["g", 0],
        [key, 10],
      ]);
      expect(result).toMatchObject({ status: "match", shortcut: { action: { href } } });
    }
  });

  it("expires the prefix after one second", () => {
    const [, justInside] = press([
      ["g", 0],
      ["o", SEQUENCE_TIMEOUT_MS],
    ]);
    expect(justInside).toMatchObject({ status: "match" });

    const [, justOutside] = press([
      ["g", 0],
      ["o", SEQUENCE_TIMEOUT_MS + 1],
    ]);
    // Too late to be a sequence, so `o` is judged on its own and means nothing.
    expect(justOutside).toEqual({ status: "none" });
  });

  it("consumes the prefix on a miss rather than replaying the key", () => {
    // `t` alone toggles the theme; `g t` goes to Labels. `g x` must do neither.
    const [, miss] = press([
      ["g", 0],
      ["x", 10],
    ]);
    expect(miss).toEqual({ status: "none" });

    const [, labels] = press([
      ["g", 0],
      ["t", 10],
    ]);
    expect(labels).toMatchObject({ status: "match", shortcut: { action: { href: "/labels" } } });
  });

  it("matches single keys straight away", () => {
    expect(press([["n", 0]])[0]).toMatchObject({
      status: "match",
      shortcut: { action: { command: "new-entry" } },
    });
    expect(press([["t", 0]])[0]).toMatchObject({
      status: "match",
      shortcut: { action: { command: "toggle-theme" } },
    });
    expect(press([["Escape", 0]])[0]).toMatchObject({
      status: "match",
      shortcut: { action: { command: "dismiss" } },
    });
  });

  it("ignores keys with no shortcut", () => {
    expect(press([["q", 0]])[0]).toEqual({ status: "none" });
  });
});

describe("isTypingTarget", () => {
  it("is true inside form fields and contenteditable", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("is false elsewhere", () => {
    expect(isTypingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget({})).toBe(false);
  });
});

describe("the map itself", () => {
  it("has no duplicate key sequences", () => {
    const seen = SHORTCUTS.map((s) => s.keys.join(" "));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("never gives a prefix key a single-key meaning", () => {
    const prefixes = new Set(SHORTCUTS.filter((s) => s.keys.length > 1).map((s) => s.keys[0]));
    const singles = SHORTCUTS.filter((s) => s.keys.length === 1).map((s) => s.keys[0]);

    expect(singles.filter((key) => prefixes.has(key))).toEqual([]);
  });

  it("groups for the shortcut sheet without losing any", () => {
    const grouped = groupedShortcuts();
    expect(grouped.map(([name]) => name)).toEqual(["Go to", "Actions", "Rows"]);
    expect(grouped.flatMap(([, items]) => items)).toHaveLength(SHORTCUTS.length);
  });
});
