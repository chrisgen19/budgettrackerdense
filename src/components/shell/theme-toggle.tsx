"use client";

import { SunMoon } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Kbd } from "@/components/ui/kbd";
import { THEME_STORAGE_KEY, type Theme, parseTheme, resolveTheme } from "@/lib/theme";

/** Reads the stored choice. Private-mode storage throws, so every access is guarded. */
function readStoredTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/**
 * Flips `.dark` on <html> and remembers the choice.
 *
 * Deliberately holds no React state: the theme lives on the document element,
 * put there before first paint by the inline script in src/lib/theme.ts, and
 * mirroring it into state would mean a render that renders nothing new. The
 * `t` shortcut calls the same `toggle`.
 */
export function useThemeToggle() {
  // Keep following the OS while the choice is "system", including a change
  // made in another tab.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      if (readStoredTheme() !== "system") return;
      document.documentElement.classList.toggle("dark", media.matches);
    };

    apply();
    media.addEventListener("change", apply);
    window.addEventListener("storage", apply);

    return () => {
      media.removeEventListener("change", apply);
      window.removeEventListener("storage", apply);
    };
  }, []);

  const toggle = useCallback(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const current = resolveTheme(readStoredTheme(), media.matches);
    const next: Theme = current === "dark" ? "light" : "dark";

    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode: the toggle still works for this page view.
    }
  }, []);

  return { toggle };
}

/** The sidebar footer's theme link. */
export function ThemeToggle() {
  const { toggle } = useThemeToggle();

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-2 rounded-panel text-left text-muted hover:text-ink"
    >
      <SunMoon aria-hidden className="size-[15px] shrink-0" strokeWidth={1.75} />
      theme
      <span className="ml-auto">
        <Kbd>t</Kbd>
      </span>
    </button>
  );
}
