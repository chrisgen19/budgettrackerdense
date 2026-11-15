import type { ReactNode } from "react";

export interface PanelProps {
  /** Bold 12px heading on the left of the header rule. */
  title?: ReactNode;
  /** Muted note beside the title (`.d-panel > header span`). */
  meta?: ReactNode;
  /** Right-hand slot: a Kbd hint, a link, a toggle. */
  actions?: ReactNode;
  /**
   * Drop the body padding. Tables sit flush against the rules, everything else
   * gets the mockup's 8px/10px (`.d-panel .body`).
   */
  flush?: boolean;
  /** Wrap the body in a horizontal scroller (`.d-scroll`). */
  scroll?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * The one container in this design: 1px rule, 4px radius, no shadow.
 * Ported from `.d-panel` in design-reference/04-data-dense.html.
 *
 * The header wraps. The right-hand slot is `shrink-0`, so without wrapping a
 * long `meta` squeezes the title to zero width and the panel loses its name --
 * which is what happened to "What is known without a plan" at 390.
 */
export function Panel({
  title,
  meta,
  actions,
  flush = false,
  scroll = false,
  className = "",
  children,
}: PanelProps) {
  const hasHeader = title !== undefined || meta !== undefined || actions !== undefined;
  const body = <div className={flush ? "" : "px-2.5 py-2"}>{children}</div>;

  return (
    <section
      className={`min-w-0 rounded-panel border border-rule bg-panel ${className}`.trimEnd()}
    >
      {hasHeader ? (
        <header className="flex flex-wrap items-center justify-between gap-x-2 border-b border-rule px-2.5 py-1.5 text-head font-semibold">
          <span className="truncate">{title}</span>
          <span className="flex shrink-0 items-center gap-2 font-normal text-muted">
            {meta}
            {actions}
          </span>
        </header>
      ) : null}

      {scroll ? <div className="overflow-x-auto">{body}</div> : body}
    </section>
  );
}
