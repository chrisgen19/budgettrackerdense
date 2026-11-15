/**
 * The keyboard map and its sequence matcher.
 *
 * Pure so it can be unit-tested without a DOM: the provider in
 * src/components/shell/keyboard-provider.tsx feeds it key names and acts on what
 * comes back. Sequences are the `g` prefix from the mockup's sidebar hints
 * (`g o`, `g l`, ...); a prefix expires after `SEQUENCE_TIMEOUT_MS`.
 */

/** How long a pending prefix waits for its second key. */
export const SEQUENCE_TIMEOUT_MS = 1000;

/**
 * The attribute a page's search field carries so `/` can focus it.
 *
 * Here rather than beside the provider that reads it: the provider is a client
 * module, and a constant exported from one becomes a client reference when a
 * server component imports it, not a string.
 */
export const SEARCH_FIELD_ATTRIBUTE = "data-search-field";

/** Everything the shell can be asked to do from the keyboard. */
export type ShortcutAction =
  | { kind: "navigate"; href: string; label: string }
  | { kind: "command"; command: ShortcutCommand };

export type ShortcutCommand =
  | "new-entry"
  | "focus-search"
  | "toggle-theme"
  | "show-shortcuts"
  | "dismiss"
  | "row-next"
  | "row-previous"
  | "row-open";

export interface Shortcut {
  /** The keys in order, as `KeyboardEvent.key` values. */
  keys: string[];
  /** How the hint renders, e.g. `g o`. */
  hint: string;
  action: ShortcutAction;
  /** Shown in the `?` sheet. Grouped by this. */
  group: "Go to" | "Actions" | "Rows";
  description: string;
}

const goTo = (key: string, href: string, label: string): Shortcut => ({
  keys: ["g", key],
  hint: `g ${key}`,
  action: { kind: "navigate", href, label },
  group: "Go to",
  description: label,
});

const command = (
  keys: string[],
  hint: string,
  cmd: ShortcutCommand,
  group: Shortcut["group"],
  description: string,
): Shortcut => ({ keys, hint, action: { kind: "command", command: cmd }, group, description });

/** The map from docs/plans/05-design-system.md, in the order the `?` sheet shows it. */
export const SHORTCUTS: readonly Shortcut[] = [
  goTo("o", "/overview", "Overview"),
  goTo("l", "/ledger", "Ledger"),
  goTo("r", "/reports", "Reports"),
  goTo("c", "/cards", "Cards"),
  goTo("u", "/budgets", "Budgets"),
  goTo("b", "/bills", "Bills"),
  goTo("t", "/labels", "Labels"),
  command(["n"], "n", "new-entry", "Actions", "New entry"),
  command(["/"], "/", "focus-search", "Actions", "Focus the search field"),
  command(["t"], "t", "toggle-theme", "Actions", "Toggle light and dark"),
  command(["?"], "?", "show-shortcuts", "Actions", "This sheet"),
  command(["Escape"], "esc", "dismiss", "Actions", "Clear filters, close dialog"),
  command(["j"], "j", "row-next", "Rows", "Next row"),
  command(["k"], "k", "row-previous", "Rows", "Previous row"),
  command(["Enter"], "⏎", "row-open", "Rows", "Open the selected row"),
];

/** The first keys of every multi-key shortcut, so the matcher knows what to hold. */
const PREFIXES = new Set(
  SHORTCUTS.filter((s) => s.keys.length > 1).map((s) => s.keys[0] as string),
);

export type MatchResult =
  | { status: "none" }
  | { status: "pending"; prefix: string }
  | { status: "match"; shortcut: Shortcut };

/** The matcher's state between keystrokes. `null` means nothing is pending. */
export interface SequenceState {
  prefix: string;
  at: number;
}

/**
 * Feeds one key to the matcher.
 *
 * Returns the next state alongside the result, rather than mutating, so the
 * provider can keep it in a ref and the test can drive it as a pure function.
 */
export function matchKey(
  key: string,
  state: SequenceState | null,
  now: number,
): { result: MatchResult; state: SequenceState | null } {
  const live = state && now - state.at <= SEQUENCE_TIMEOUT_MS ? state : null;

  if (live) {
    const shortcut = SHORTCUTS.find(
      (s) => s.keys.length === 2 && s.keys[0] === live.prefix && s.keys[1] === key,
    );
    // The prefix is always consumed: `g x` is a miss, not a fresh `x`.
    return shortcut
      ? { result: { status: "match", shortcut }, state: null }
      : { result: { status: "none" }, state: null };
  }

  if (PREFIXES.has(key)) {
    return { result: { status: "pending", prefix: key }, state: { prefix: key, at: now } };
  }

  const shortcut = SHORTCUTS.find((s) => s.keys.length === 1 && s.keys[0] === key);
  return shortcut
    ? { result: { status: "match", shortcut }, state: null }
    : { result: { status: "none" }, state: null };
}

/**
 * Whether a key event should be ignored because the user is typing.
 *
 * Takes the bare facts rather than an element so it stays testable in Node.
 */
export function isTypingTarget(target: {
  tagName?: string;
  isContentEditable?: boolean;
  type?: string;
}): boolean {
  if (target.isContentEditable) return true;

  const tag = target.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

/** Roles that mean "Enter activates me", on elements that are not natively interactive. */
const ACTIVATION_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
]);

/**
 * Whether Enter on this element belongs to the element itself.
 *
 * A focused link, button or summary activates on Enter natively; the row-open
 * shortcut must not swallow that. Takes bare facts, like `isTypingTarget`.
 */
export function isActivationTarget(target: { tagName?: string; role?: string | null }): boolean {
  const tag = target.tagName?.toLowerCase();
  if (tag === "a" || tag === "button" || tag === "summary") return true;

  return target.role ? ACTIVATION_ROLES.has(target.role) : false;
}

/** Shortcuts grouped for the `?` sheet, in map order. */
export function groupedShortcuts(): [Shortcut["group"], Shortcut[]][] {
  const groups = new Map<Shortcut["group"], Shortcut[]>();
  for (const shortcut of SHORTCUTS) {
    const existing = groups.get(shortcut.group);
    if (existing) existing.push(shortcut);
    else groups.set(shortcut.group, [shortcut]);
  }

  return [...groups];
}
