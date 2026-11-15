/**
 * The limit bar.
 *
 * **Only the bar clamps.** A bar has no width past full and none below empty,
 * so its fill is rounded into 0-100; the percentage printed beside it is the
 * server's untouched figure. budgettracker's `/cards` once clamped the figure
 * too and so disagreed with `/cards/[id]` in exactly the two cases that matter:
 * 108.3% read as "100%" on one page and correctly on the other
 * (`.claude/rules/cards.md`).
 */
export function limitBarPercent(utilization: number): number {
  return Math.min(Math.max(Math.round(utilization), 0), 100);
}

/** Above this share of the limit the bar and the figure turn red. */
export const HIGH_UTILIZATION = 80;

export function LimitBar({ utilization }: { utilization: number }) {
  const high = utilization > HIGH_UTILIZATION;

  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-full min-w-10 rounded-[1px] bg-track align-middle"
    >
      <span
        className={`block h-full rounded-[1px] ${high ? "bg-expense" : "bg-accent"}`}
        style={{ width: `${limitBarPercent(utilization)}%` }}
      />
    </span>
  );
}
