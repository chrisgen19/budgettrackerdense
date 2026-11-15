import { describe, expect, it } from "vitest";
import { attemptFor } from "./save-attempt";

const counter = () => {
  let n = 0;
  return () => `key-${(n += 1)}`;
};

describe("attemptFor", () => {
  it("starts a fresh key when nothing is pending", () => {
    expect(attemptFor(null, "A", counter())).toEqual({ key: "key-1", signature: "A" });
  });

  it("reuses the pending key for the same payload, so a retry replays", () => {
    const pending = { key: "key-1", signature: "A" };
    expect(attemptFor(pending, "A", counter())).toBe(pending);
  });

  it("never sends an edited payload under the old key", () => {
    const pending = { key: "old", signature: "A" };
    expect(attemptFor(pending, "B", counter())).toEqual({ key: "key-1", signature: "B" });
  });
});
