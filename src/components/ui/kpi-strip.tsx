import type { ReactNode } from "react";

export interface KpiProps {
  /** The muted label above the figure. */
  label: ReactNode;
  /** The figure itself: a `<Money>`, usually. */
  value: ReactNode;
  /** A sparkline, drawn to the right of the figure. */
  chart?: ReactNode;
  /** The small muted line underneath, e.g. "103% used, day 28/30". */
  note?: ReactNode;
}

/**
 * One cell of the KPI strip (`.d-kpi`). The figure and the chart share a row
 * aligned to their baselines; label and note span both columns.
 */
export function Kpi({ label, value, chart, note }: KpiProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-x-2 border-r border-b border-rule-2 px-2.5 py-2 last:border-r-0 desk:border-b-0">
      <dt className="col-span-full text-meta text-muted">{label}</dt>
      <dd className="m-0 tnum text-kpi font-medium whitespace-nowrap">{value}</dd>
      {chart ? <div className="flex items-end justify-end">{chart}</div> : null}
      {note ? <small className="col-span-full text-label text-muted">{note}</small> : null}
    </div>
  );
}

/**
 * The strip itself (`.d-kpis`): two cells per row on a phone, six across on the
 * desktop layout, inside one panel border.
 */
export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <dl className="m-0 grid grid-cols-2 overflow-hidden rounded-panel border border-rule bg-panel desk:grid-cols-6">
      {children}
    </dl>
  );
}
