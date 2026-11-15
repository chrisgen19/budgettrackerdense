import type { ReactNode } from "react";

/** A shortcut hint. Ported from `.m kbd`: 10.5px, mono, a thicker bottom rule. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-chip border border-b-2 border-rule bg-panel px-1 font-mono text-[10.5px] text-muted">
      {children}
    </kbd>
  );
}
