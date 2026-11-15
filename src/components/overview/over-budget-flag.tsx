import { Flag } from "@/components/ui/flag";
import { formatAmount, formatPercent } from "@/lib/money";
import { monthShort } from "@/lib/month-nav";
import type { OverviewOverBudget } from "@/server/queries/overview";

/** The strip above the KPI row: how far over, since when, and where the month lands. */
export function OverBudgetFlag({
  over,
  month,
  isPartial,
}: {
  over: OverviewOverBudget;
  month: string;
  isPartial: boolean;
}) {
  return (
    <Flag>
      Over budget by{" "}
      <b className="tnum text-figure font-medium">{formatAmount(over.amountOver)}</b>
      {over.dayCrossed ? (
        <>
          {" "}
          since {monthShort(month)} {Number(over.dayCrossed.slice(8, 10))}
        </>
      ) : null}
      .{" "}
      {isPartial ? (
        <>
          Projected month end{" "}
          <b className="tnum text-figure font-medium">
            {formatAmount(over.projected, { dp: 0 })}
          </b>{" "}
          ({formatPercent(over.overBy)} over).
        </>
      ) : (
        <>Finished {formatPercent(over.overBy)} over.</>
      )}
    </Flag>
  );
}
