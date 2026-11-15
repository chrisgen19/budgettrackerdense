import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DARK_TOKENS, LIGHT_TOKENS, type ThemeTokens } from "./tokens";

/**
 * The tokens live twice: as CSS custom properties the app actually paints with,
 * and as the TypeScript copy the contrast test measures. This asserts the two
 * agree, so measuring the copy means something.
 */
const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

/** Pulls `--name: value;` pairs out of one top-level block. */
function readBlock(selector: string): Record<string, string> {
  const block = new RegExp(`^${selector.replace(".", "\\.")} \\{\\n([\\s\\S]*?)^\\}`, "m").exec(css);
  if (!block?.[1]) throw new Error(`No "${selector}" block in globals.css.`);

  const declarations: Record<string, string> = {};
  for (const line of block[1].split("\n")) {
    const match = /^\s*--([\w-]+):\s*(.+);\s*$/.exec(line);
    if (match?.[1] && match[2]) declarations[match[1]] = match[2];
  }

  return declarations;
}

describe.each([
  [":root", LIGHT_TOKENS],
  [".dark", DARK_TOKENS],
])("%s matches its TypeScript copy", (selector, expected: ThemeTokens) => {
  const declared = readBlock(selector);

  it.each(Object.entries(expected))("--%s", (name, value) => {
    expect(declared[name]).toBe(value);
  });

  it("declares nothing the copy is missing", () => {
    expect(Object.keys(declared).sort()).toEqual(Object.keys(expected).sort());
  });
});
