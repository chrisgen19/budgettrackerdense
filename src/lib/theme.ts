/**
 * Light/dark as a `.dark` class on <html>.
 *
 * A class rather than `prefers-color-scheme` alone, because the `t` shortcut has
 * to override the OS. The choice is stored per browser; "system" means follow
 * the OS and keep following it when it changes.
 */
export const THEME_STORAGE_KEY = "dense-theme";

export type Theme = "light" | "dark" | "system";

/** Narrows an unknown stored value to a theme, defaulting to "system". */
export function parseTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

/** The class that should be on <html> for a theme, given the OS preference. */
export function resolveTheme(theme: Theme, prefersDark: boolean): "light" | "dark" {
  if (theme === "system") return prefersDark ? "dark" : "light";

  return theme;
}

/**
 * Runs before first paint, inlined in the document head, so the page never
 * renders light and then flips. Kept as a string because it cannot wait for
 * hydration; it mirrors `resolveTheme` and the two must change together.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}`;
