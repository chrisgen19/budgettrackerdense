/**
 * The colour tokens, mirrored from src/app/globals.css.
 *
 * CSS cannot be imported into a Node test, so the values live here too and
 * src/lib/tokens.test.ts asserts the two copies match by parsing the stylesheet.
 * Nothing in the app reads these: components use the Tailwind utilities.
 */
export interface ThemeTokens {
  bg: string;
  panel: string;
  rule: string;
  "rule-2": string;
  ink: string;
  muted: string;
  accent: string;
  "accent-soft": string;
  "accent-ink": string;
  income: string;
  expense: string;
  "warn-bg": string;
  track: string;
  grid: string;
  sk: string;
  heat: string;
}

export const LIGHT_TOKENS: ThemeTokens = {
  bg: "#f4f5f2",
  panel: "#ffffff",
  rule: "#d8dbd4",
  "rule-2": "#eceee9",
  ink: "#15181c",
  muted: "#565c64",
  accent: "#1f5fd1",
  "accent-soft": "rgba(31, 95, 209, 0.1)",
  "accent-ink": "#ffffff",
  income: "#17704a",
  expense: "#b0282b",
  "warn-bg": "#fcecec",
  track: "#eceee9",
  grid: "#eceee9",
  sk: "#e7e9e4",
  heat: "31 95 209",
};

export const DARK_TOKENS: ThemeTokens = {
  bg: "#12161b",
  panel: "#181d23",
  rule: "#2a313a",
  "rule-2": "#20262d",
  ink: "#e3e7ec",
  muted: "#929ba6",
  accent: "#79a8ff",
  "accent-soft": "rgba(121, 168, 255, 0.14)",
  "accent-ink": "#0b1220",
  income: "#52c892",
  expense: "#ff8078",
  "warn-bg": "rgba(255, 128, 120, 0.1)",
  track: "#232a32",
  grid: "#232a32",
  sk: "#222830",
  heat: "121 168 255",
};

export const THEMES = { light: LIGHT_TOKENS, dark: DARK_TOKENS } as const;
