import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";
import { Kpi, KpiStrip } from "@/components/ui/kpi-strip";
import { Money } from "@/components/ui/money";
import { MINUS, formatAmount, formatPercent } from "@/lib/money";
import { budgetEditorUrl } from "@/lib/links";
import type { Overview } from "@/server/queries/overview";

/**
 * The six figures the month is read from.
 *
 * Budget and Remaining depend on a `BudgetPlan`. Without one they say so and
 * link to budgettracker's editor; they are never filled with an average of
 * previous months, which would read as a target somebody set.
 */
export function KpiRow({ overview }: { overview: Overview }) {
  const { budget, progress, monthly } = overview;
  const income = monthly.map((row) => row.income);
  const expenses = monthly.map((row) => row.expenses);
  const net = monthly.map((row) => Math.max(row.net, 0));

  const delta = overview.versusPrevious;
  const deltaNote =
    delta.previousTotal === 0
      ? "no spend to compare"
      : `${delta.change < 0 ? "▼" : "▲"} ${formatAmount(Math.abs(delta.change), { dp: 0 })} vs last month${
          delta.throughDay === null ? "" : ` (to day ${delta.throughDay})`
        }`;

  return (
    <KpiStrip>
      <Kpi
        label="Income"
        value={<Money value={overview.income} tone="income" bare />}
        chart={<Sparkline values={income} color="var(--income)" />}
      />

      <Kpi
        label="Spent"
        value={<Money value={overview.spent} bare />}
        chart={<Sparkline values={expenses} color="var(--expense)" />}
        note={deltaNote}
      />

      {budget ? (
        <Kpi
          label="Budget"
          value={<Money value={budget.planned} bare dp={0} />}
          note={`pace ${formatAmount(budget.pace, { dp: 0 })}/day`}
        />
      ) : (
        <Kpi
          label="Budget"
          value={<span className="text-muted">No plan</span>}
          note={
            <Link href={budgetEditorUrl()} className="text-accent underline">
              Set one in budgettracker
            </Link>
          }
        />
      )}

      {budget ? (
        <Kpi
          label="Remaining"
          value={
            <Money
              value={budget.remaining}
              tone={budget.remaining < 0 ? "expense" : "income"}
              bare
            />
          }
          note={`${formatPercent(budget.usedPct)} used, day ${progress.daysElapsed}/${progress.daysInMonth}`}
        />
      ) : (
        <Kpi
          label="Remaining"
          value={<span className="text-muted">{MINUS}</span>}
          note="needs a budget plan"
        />
      )}

      <Kpi
        label="Burn / day"
        value={<Money value={overview.burnPerDay} bare dp={0} />}
        note={
          // A finished month has nothing left to project: its spend is the answer.
          progress.isPartial && overview.projected !== null
            ? `projected ${formatAmount(overview.projected, { dp: 0 })}`
            : `day ${progress.daysElapsed}/${progress.daysInMonth}`
        }
      />

      <Kpi
        label="Net"
        value={
          <Money value={overview.net} tone={overview.net < 0 ? "expense" : "income"} bare sign />
        }
        chart={<Sparkline values={net} color="var(--accent)" />}
      />
    </KpiStrip>
  );
}
