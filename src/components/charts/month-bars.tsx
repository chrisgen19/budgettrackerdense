import { formatMoney } from "@/lib/money";

export interface MonthBar {
  /** Short month name, e.g. "Sep". */
  label: string;
  income: number;
  expense: number;
  /** No rows at all that month. Drawn as "no data", never as a zero bar. */
  empty?: boolean;
}

export interface MonthBarsProps {
  months: readonly MonthBar[];
  width?: number;
  height?: number;
  /** Corner radius; the mockup's report panel uses 1. */
  radius?: number;
  /** Gap between the income and spend bar of one month. */
  innerGap?: number;
}

/**
 * Income against spend per month, ported from `charts.bars` in
 * design-reference/shared/core.js.
 *
 * A month with no rows prints "no data" instead of a zero-height bar: zero and
 * unknown are different answers, and the local mirror has months of each.
 *
 * One deliberate change from the mockup: the month labels are HTML under the
 * plot rather than `<text>` inside it. The plot stretches to its panel with
 * `preserveAspectRatio="none"`, which widens glyphs by whatever factor the
 * panel is wider than the 520pt viewBox -- legible in the mockup's narrow
 * column, badly distorted in a 1200px panel. Bars are rectangles and do not
 * care; text does.
 */
export function MonthBars({
  months,
  width = 520,
  height = 150,
  radius = 1,
  innerGap = 2,
}: MonthBarsProps) {
  if (months.length === 0) return null;

  const max = Math.max(...months.flatMap((month) => [month.income, month.expense]), 1) * 1.08;
  // No label gutter inside the plot any more; the labels sit under it in HTML.
  const padding = 6;
  const columnWidth = width / months.length;
  const barWidth = Math.min(22, columnWidth / 3);
  const y = (value: number) => height - padding - (value / max) * (height - padding - 6);

  const summary = months
    .map((month) =>
      month.empty
        ? `${month.label} no data`
        : `${month.label} in ${formatMoney(month.income, { dp: 0 })} out ${formatMoney(month.expense, { dp: 0 })}`,
    )
    .join("; ");

  return (
    <div role="img" aria-label={`Income and spending by month. ${summary}.`}>
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="block overflow-visible"
      aria-hidden
    >
      {[0.25, 0.5, 0.75, 1].map((fraction) => (
        <line
          key={fraction}
          x1={0}
          x2={width}
          y1={y((max * fraction) / 1.08)}
          y2={y((max * fraction) / 1.08)}
          stroke="var(--grid)"
          strokeWidth={1}
        />
      ))}

      {months.map((month, index) => {
        const centre = index * columnWidth + columnWidth / 2;
        const bar = (value: number, x: number, fill: string) =>
          value > 0 ? (
            <rect
              x={x}
              y={y(value)}
              width={barWidth}
              height={height - padding - y(value)}
              rx={radius}
              fill={fill}
            />
          ) : null;

        return (
          <g key={month.label}>
            {bar(month.income, centre - barWidth - innerGap / 2, "var(--income)")}
            {bar(month.expense, centre + innerGap / 2, "var(--expense)")}
          </g>
        );
      })}
    </svg>

      <div className="flex text-center text-label text-muted">
        {months.map((month) => (
          <div key={month.label} className="flex-1">
            {month.empty ? <div className="leading-tight">no data</div> : null}
            <div>{month.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
