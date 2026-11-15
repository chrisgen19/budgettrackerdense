import { OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The over-budget strip above the KPI row (`.d-flag`). A `role="status"` so a
 * screen reader announces it when the page updates, not an alert: the money is
 * already spent, nothing is urgent.
 */
export function Flag({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="mb-2 flex items-center gap-2 rounded-panel border border-expense/35 bg-warn-bg px-2.5 py-1.5"
    >
      <OctagonAlert aria-hidden className="size-[15px] shrink-0 text-expense" strokeWidth={1.75} />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
