import { formatMoney } from "@/lib/money";
import type { BurnPoint } from "./burn-chart";

export interface DayBarsProps {
  cumulative: readonly BurnPoint[];
  /** Days above this are drawn in the expense colour. Usually 2x the pace. */
  limit?: number;
  width?: number;
  height?: number;
}

/**
 * Daily spend under the burn chart, ported from `charts.dayBars`. Red above the
 * limit, which the Overview sets to twice the straight-line pace.
 */
export function DayBars({ cumulative, limit, width = 300, height = 34 }: DayBarsProps) {
  if (cumulative.length === 0) return null;

  const max = Math.max(...cumulative.map((point) => point.daySpend), 1);
  const barWidth = width / cumulative.length;
  const overCount =
    limit === undefined ? 0 : cumulative.filter((point) => point.daySpend > limit).length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Spending per day, highest ${formatMoney(max, { dp: 0 })}${
        limit === undefined
          ? ""
          : `, ${overCount} ${overCount === 1 ? "day" : "days"} over ${formatMoney(limit, { dp: 0 })}`
      }.`}
    >
      {cumulative.map((point) => {
        const barHeight = (point.daySpend / max) * height;
        return (
          <rect
            key={point.day}
            x={(point.day - 1) * barWidth + 0.5}
            y={height - barHeight}
            width={Math.max(barWidth - 1, 0.5)}
            height={barHeight}
            fill={limit !== undefined && point.daySpend > limit ? "var(--expense)" : "var(--muted)"}
          />
        );
      })}
    </svg>
  );
}
