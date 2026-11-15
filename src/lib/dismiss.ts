/**
 * The `Esc` seam.
 *
 * The keyboard map gives Escape two jobs: close a dialog, and clear the page's
 * filters. The provider owns the first (it knows about the shortcut sheet) and
 * cannot know about the second, so when nothing of its own was open it
 * announces the keypress and whichever page is mounted decides what to clear.
 */
export const DISMISS_EVENT = "dense:dismiss";
