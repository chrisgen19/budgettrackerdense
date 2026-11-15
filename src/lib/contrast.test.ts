import { describe, expect, it } from "vitest";
import { contrastRatio, flatten, parseColor, relativeLuminance } from "./contrast";
import { THEMES, type ThemeTokens } from "./tokens";

/** WCAG AA for body text. Every pair below renders text at 11px or more. */
const AA = 4.5;

describe("parseColor", () => {
  it("reads hex, short hex, rgb, rgba and bare triples", () => {
    expect(parseColor("#15181C")).toEqual({ r: 21, g: 24, b: 28, a: 1 });
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("rgba(31, 95, 209, 0.1)")).toEqual({ r: 31, g: 95, b: 209, a: 0.1 });
    expect(parseColor("rgb(31 95 209)")).toEqual({ r: 31, g: 95, b: 209, a: 1 });
    expect(parseColor("121 168 255")).toEqual({ r: 121, g: 168, b: 255, a: 1 });
  });

  it("refuses anything else", () => {
    expect(() => parseColor("rebeccapurple")).toThrow(/Cannot parse/);
  });
});

describe("relativeLuminance and contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 10);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 10);
    // Symmetric: order of the arguments does not change the ratio.
    expect(contrastRatio("#1f5fd1", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#1f5fd1"), 10);
  });

  it("flattens a translucent foreground over the background first", () => {
    const half = flatten("rgba(0, 0, 0, 0.5)", "#ffffff");
    expect(half).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
    expect(contrastRatio("rgba(0, 0, 0, 0)", "#ffffff")).toBeCloseTo(1, 10);
  });
});

/** Every place the design puts text on a surface, as a [label, fg, bg] triple. */
function textPairs(t: ThemeTokens): [string, string, string | ReturnType<typeof flatten>][] {
  const warn = flatten(t["warn-bg"], t.panel);
  const hover = flatten(t["accent-soft"], t.panel);

  return [
    ["ink on bg", t.ink, t.bg],
    ["ink on panel", t.ink, t.panel],
    ["muted on bg", t.muted, t.bg],
    ["muted on panel", t.muted, t.panel],
    ["accent on panel", t.accent, t.panel],
    ["accent on bg", t.accent, t.bg],
    ["income on panel", t.income, t.panel],
    ["income on bg", t.income, t.bg],
    ["expense on panel", t.expense, t.panel],
    ["expense on bg", t.expense, t.bg],
    ["ink on the over-budget flag", t.ink, warn],
    ["expense on the over-budget flag", t.expense, warn],
    ["accent-ink on accent (pressed chips, save button)", t["accent-ink"], t.accent],
    ["ink on a hovered row", t.ink, hover],
    ["muted on a hovered row", t.muted, hover],
    ["ink on a subtotal row", t.ink, t["rule-2"]],
    ["muted on a subtotal row", t.muted, t["rule-2"]],
  ];
}

describe.each(Object.entries(THEMES))("%s tokens meet WCAG AA", (_theme, tokens) => {
  it.each(textPairs(tokens))("%s", (_label, foreground, background) => {
    expect(contrastRatio(foreground, background as string)).toBeGreaterThanOrEqual(AA);
  });
});
