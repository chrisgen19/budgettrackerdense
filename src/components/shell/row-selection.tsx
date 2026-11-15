"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { ROW_COMMAND_EVENT, type RowCommandDetail } from "@/lib/row-commands";

/**
 * Makes the rows inside it navigable with `j`, `k` and Enter.
 *
 * Works off the `data-row` attributes `DataTable` writes, so the table itself
 * stays a server component. Selection is a `data-selected` attribute rather
 * than React state: moving a highlight should not re-render a 300-row table.
 */
export function RowSelection({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  const move = useCallback((step: number) => {
    const root = scope.current;
    if (!root) return;

    const rows = [...root.querySelectorAll<HTMLElement>("[data-row]")].filter(
      (row) => row.offsetParent !== null,
    );
    if (rows.length === 0) return;

    const current = rows.findIndex((row) => row.hasAttribute("data-selected"));
    const next = current === -1 ? (step > 0 ? 0 : rows.length - 1) : current + step;
    const clamped = Math.min(Math.max(next, 0), rows.length - 1);

    for (const row of rows) row.removeAttribute("data-selected");
    const selected = rows[clamped];
    if (!selected) return;

    selected.setAttribute("data-selected", "");
    selected.scrollIntoView({ block: "nearest" });
  }, []);

  const open = useCallback(() => {
    scope.current?.querySelector<HTMLElement>("[data-row][data-selected] a, [data-row][data-selected] button")?.click();
  }, []);

  useEffect(() => {
    const onCommand = (event: Event) => {
      const { command } = (event as CustomEvent<RowCommandDetail>).detail;
      if (command === "row-next") move(1);
      if (command === "row-previous") move(-1);
      if (command === "row-open") open();
    };

    document.addEventListener(ROW_COMMAND_EVENT, onCommand);
    return () => document.removeEventListener(ROW_COMMAND_EVENT, onCommand);
  }, [move, open]);

  return <div ref={scope}>{children}</div>;
}
