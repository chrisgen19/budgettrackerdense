import { BurnChart, type BurnPoint } from "@/components/charts/burn-chart";
import { DayBars } from "@/components/charts/day-bars";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import type { DailySpend } from "@/server/queries/daily-spend";
import type { OverviewBudget } from "@/server/queries/overview";

/** Red above twice the plan's straight-line pace, as in the mockup. */
const RED_FACTOR = 2;

/** `YYYY-MM-DD` to its day number. The charts plot a day of the month, not a date. */
function toBurnPoints(daily: DailySpend): BurnPoint[] {
  return daily.days.map((day) => ({
    day: Number(day.day.slice(8, 10)),
    spent: day.cumulative,
    daySpend: day.amount,
  }));
}

/**
 * Cumulative spend against the plan, with the day bars underneath.
 *
 * With no plan there is no dashed budget line, no dotted pace line and no red
 * threshold on the bars: the panel's meta says so instead. A pace drawn from an
 * average of previous months would look exactly like a target that was set.
 */
export function BurnPanel({
  daily,
  budget,
  daysInMonth,
}: {
  daily: DailySpend;
  budget: OverviewBudget | null;
  daysInMonth: number;
}) {
  const points = toBurnPoints(daily);

  return (
    <Panel
      title="Cumulative spend vs budget"
      meta={budget ? "dashed = budget, dotted = pace" : "no budget plan for this month"}
    >
      {points.length === 0 ? (
        <EmptyState title="Nothing logged yet">
          The burn chart starts on the first day with a transaction.
        </EmptyState>
      ) : (
        <>
          <BurnChart cumulative={points} budget={budget?.planned ?? null} daysInMonth={daysInMonth} />

          <div className="mt-2">
            <DayBars
              cumulative={points}
              daysInMonth={daysInMonth}
              limit={budget ? budget.pace * RED_FACTOR : undefined}
            />
          </div>

          <div className="flex justify-between text-label text-muted">
            <span className="tnum">01</span>
            <span>
              {budget ? `daily spend, red = over ${RED_FACTOR}× pace` : "daily spend"}
            </span>
            <span className="tnum">{daysInMonth}</span>
          </div>
        </>
      )}
    </Panel>
  );
}
