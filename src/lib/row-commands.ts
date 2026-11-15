import type { ShortcutCommand } from "@/lib/keyboard";

/**
 * The seam between the global keyboard layer and whatever table is on screen.
 *
 * A DOM event rather than context: the keyboard provider lives in the shell
 * layout and the table is somewhere inside the page below it, so there is no
 * React tree they usefully share without lifting table state into the layout.
 */
export const ROW_COMMAND_EVENT = "dense:row-command";

export interface RowCommandDetail {
  command: Extract<ShortcutCommand, "row-next" | "row-previous" | "row-open">;
}

/** True for the three commands a table handles. */
export function isRowCommand(command: ShortcutCommand): command is RowCommandDetail["command"] {
  return command === "row-next" || command === "row-previous" || command === "row-open";
}
