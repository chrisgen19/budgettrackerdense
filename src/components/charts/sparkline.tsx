/**
 * Ported from `charts.spark` in design-reference/shared/core.js.
 *
 * Fixed pixel size, not responsive: it sits beside a KPI figure and must not
 * change the row's height.
 */
export interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  /** Any CSS colour; the callers pass `var(--income)` and friends. */
  color?: string;
  /** Dot on the last point. */
  dot?: boolean;
  /**
   * An `aria-label`. Left off by default on purpose: a sparkline next to a KPI
   * repeats a figure already in the text, so it is decorative there.
   */
  label?: string;
}

export function Sparkline({
  values,
  width = 56,
  height = 18,
  color = "currentColor",
  dot = true,
  label,
}: SparklineProps) {
  if (values.length === 0) return null;

  const max = Math.max(...values, 1);
  // One value would divide by zero in the mockup's formula; draw it mid-span.
  const x = (index: number) =>
    values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - 4) + 2;
  const y = (value: number) => height - 2 - (value / max) * (height - 4);

  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`);
  const last = values[values.length - 1] as number;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {dot ? <circle cx={x(values.length - 1)} cy={y(last)} r={2} fill={color} /> : null}
    </svg>
  );
}
