"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  SEARCH_FIELD_ATTRIBUTE,
  type SequenceState,
  type ShortcutCommand,
  isActivationTarget,
  isTypingTarget,
  matchKey,
} from "@/lib/keyboard";
import { DISMISS_EVENT } from "@/lib/dismiss";
import { ROW_COMMAND_EVENT, type RowCommandDetail, isRowCommand } from "@/lib/row-commands";
import { ShortcutSheet } from "./shortcut-sheet";
import { useThemeToggle } from "./theme-toggle";

/**
 * The global keyboard layer.
 *
 * Mounted once in the app shell. It owns the sequence matcher's state, ignores
 * every key typed into a field, and turns a match into either a route change or
 * a command. Row commands are forwarded as a DOM event; see src/lib/row-commands.ts.
 */
export function KeyboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { toggle } = useThemeToggle();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const sequence = useRef<SequenceState | null>(null);

  const runCommand = useCallback(
    (command: ShortcutCommand) => {
      if (isRowCommand(command)) {
        document.dispatchEvent(
          new CustomEvent<RowCommandDetail>(ROW_COMMAND_EVENT, { detail: { command } }),
        );
        return;
      }

      if (command === "new-entry") router.push("/new");
      if (command === "toggle-theme") toggle();
      if (command === "show-shortcuts") setShortcutsOpen(true);
      if (command === "dismiss") {
        // Only the page knows what its filters are; see src/lib/dismiss.ts.
        if (shortcutsOpen) setShortcutsOpen(false);
        else document.dispatchEvent(new CustomEvent(DISMISS_EVENT));
      }
      if (command === "focus-search") {
        document.querySelector<HTMLInputElement>(`[${SEARCH_FIELD_ATTRIBUTE}]`)?.focus();
      }
    },
    [router, toggle, shortcutsOpen],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // ⌘K / Ctrl+K is the one chord; every other shortcut is a bare key.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/new");
        return;
      }

      // A control that already handled the key keeps it.
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Enter on a focused link or button is that control's own activation.
      if (event.key === "Enter" && event.target instanceof HTMLElement && isActivationTarget(event.target)) {
        return;
      }
      if (event.target instanceof HTMLElement && isTypingTarget(event.target)) {
        // Escape still works in a field, to give focus and filters back.
        if (event.key !== "Escape") return;
        event.target.blur();
      }

      const { result, state } = matchKey(event.key, sequence.current, Date.now());
      sequence.current = state;
      if (result.status !== "match") return;

      event.preventDefault();
      const { action } = result.shortcut;
      if (action.kind === "navigate") router.push(action.href);
      else runCommand(action.command);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router, runCommand]);

  return (
    <>
      {children}
      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
