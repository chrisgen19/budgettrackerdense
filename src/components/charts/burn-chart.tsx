import { formatMoney } from "@/lib/money";

/** One day of the month: the running total and that day's own spend. */
export interface BurnPoint {
  day: number;
  spent: number;
  daySpend: number;
}

export interface BurnChartProps {
  cumulative: readonly BurnPoint[];
  /**
   * Days in the month. The x axis always spans the whole month, so a running
   * month plots only up to today and the pace line ends at the month's last day.
   */
  daysInMonth: number;
  /**
   * The month's budget, or null when no BudgetPlan exists. With null the budget
   * and pace lines are not drawn at all: a guessed line on a money chart is a
   * lie (docs/plans/00-overview.md, "no plan for this month").
   */
  budget: number | null;
  width?: number;
  height?: number;
  strokeWidth?: number;
}

/**
 * Where day `day` sits on an axis `width` wide that spans the whole month:
 * day 1 at the left edge, the month's last day at the right.
 */
export const dayPosition = (day: number, daysInMonth: number, width: number): number =>
  daysInMonth <= 1 ? width : ((day - 1) / (daysInMonth - 1)) * width;

/**
 * Cumulative spend against budget, ported from `charts.burn` in
 * design-reference/shared/core.js: filled area, dashed budget line, dotted
 * straight-line pace, and a dot on the day the budget was crossed.
 *
 * `preserveAspectRatio="none"` with a percentage width is how the mockup makes
 * it fill its panel; strokes use `vector-effect="non-scaling-stroke"` so that
 * stretch does not thicken them.
 */
export function BurnChart({
  cumulative,
  budget,
  daysInMonth,
  width = 520,
  height = 160,
  strokeWidth = 1.75,
}: BurnChartProps) {
  if (cumulative.length === 0) return null;

  const last = cumulative[cumulative.length - 1] as BurnPoint;
  const max = Math.max(budget ?? 0, last.spent, 1) * 1.08;
  const x = (day: number) => dayPosition(day, daysInMonth, width);
  const y = (value: number) => height - (value / max) * height;

  const points = cumulative.map((point) => `${x(point.day).toFixed(1)},${y(point.spent).toFixed(1)}`);
  const line = points.join(" ");
  const overDay = budget === null ? undefined : cumulative.find((point) => point.spent > budget);

  const label =
    budget === null
      ? `Cumulative spending, ${formatMoney(last.spent)} by day ${last.day}. No budget plan for this month.`
      : `Cumulative spending against a ${formatMoney(budget, { dp: 0 })} budget: ${formatMoney(last.spent)} by day ${last.day}${overDay ? `, over budget from day ${overDay.day}` : ""}.`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="block overflow-visible"
      role="img"
      aria-label={label}
    >
      <polygon points={`0,${height} ${line} ${x(last.day).toFixed(1)},${height}`} fill="var(--accent-soft)" />

      {budget === null ? null : (
        <>
          <line
            x1={0}
            y1={y(budget)}
            x2={width}
            y2={y(budget)}
            stroke="var(--expense)"
            strokeDasharray="4 4"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={0}
            y1={height}
            x2={width}
            y2={y(budget)}
            stroke="var(--muted)"
            strokeDasharray="2 4"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}

      <polyline
        points={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {overDay ? (
        <circle cx={x(overDay.day)} cy={y(overDay.spent)} r={4} fill="var(--expense)" />
      ) : null}
    </svg>
  );
}
