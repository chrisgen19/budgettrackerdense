import { DataTable, Swatch } from "@/components/ui/data-table";
import { Kpi, KpiStrip } from "@/components/ui/kpi-strip";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { formatPercent } from "@/lib/money";
import type { BudgetPerformanceAllocation, BudgetPerformanceData } from "@bt/types";

/** Plain words for the four allocation kinds. */
const KIND_LABEL: Record<string, string> = {
  INCOME: "Income",
  FIXED: "Fixed",
  FLEXIBLE: "Flexible",
  SAVINGS: "Savings",
};

/** The headline figures for a month that does have a plan. */
export function PlanTotals({ performance }: { performance: BudgetPerformanceData }) {
  const { totals, progress, forecastStatus } = performance;

  return (
    <KpiStrip>
      <Kpi
        label="Planned"
        value={<Money value={totals.plannedExpenses} bare dp={0} />}
        note={
          totals.availableExpenses === totals.plannedExpenses
            ? undefined
            : `${formatMoneyShort(totals.availableExpenses)} with rollover`
        }
      />
      <Kpi label="Spent" value={<Money value={totals.actualExpenses} bare />} />
      <Kpi
        label="Remaining"
        value={
          <Money
            value={totals.remainingExpenses}
            tone={totals.remainingExpenses < 0 ? "expense" : "income"}
            bare
          />
        }
        note={`day ${progress.daysElapsed}/${progress.daysInMonth}`}
      />
      <Kpi
        label="Projected"
        value={
          // Null while the month has not started: there is nothing to project
          // from, and a zero would read as a forecast of no spending.
          totals.projectedExpenses === null ? (
            <span className="text-muted">
              {forecastStatus === "not-started" ? "not started" : "no activity"}
            </span>
          ) : (
            <Money value={totals.projectedExpenses} bare dp={0} />
          )
        }
        note={
          totals.projectedVariance === null
            ? undefined
            : `${totals.projectedVariance < 0 ? "over" : "under"} by ${formatMoneyShort(Math.abs(totals.projectedVariance))}`
        }
      />
      <Kpi
        label="Unbudgeted"
        value={
          <Money
            value={totals.unbudgetedExpenses}
            tone={totals.unbudgetedExpenses > 0 ? "expense" : "plain"}
            bare
            dp={0}
          />
        }
        note="spent outside any allocation"
      />
      <Kpi
        label="Income"
        value={<Money value={totals.actualIncome} tone="income" bare />}
        note={
          totals.plannedIncome === 0
            ? "none planned"
            : `planned ${formatMoneyShort(totals.plannedIncome)}`
        }
      />
    </KpiStrip>
  );
}

/** A compact figure for a KPI's sub-line. */
function formatMoneyShort(value: number): string {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value);
}

/** Category by category: what was planned, what was spent, what is left. */
export function AllocationsTable({ performance }: { performance: BudgetPerformanceData }) {
  const { allocations } = performance;
  const anyRollover = allocations.some((row) => row.rolloverEnabled);

  return (
    <DataTable<BudgetPerformanceAllocation>
      caption={`Budget allocations for ${performance.periodLabel}`}
      columns={[
        {
          key: "category",
          header: "Category",
          truncate: true,
          cell: (row) => (
            <>
              <Swatch color={row.categoryColor} />
              {row.categoryName}
            </>
          ),
        },
        {
          key: "kind",
          header: "Kind",
          hideBelow: "wide",
          cell: (row) => <span className="text-muted">{KIND_LABEL[row.kind] ?? row.kind}</span>,
        },
        {
          key: "planned",
          header: "Planned",
          align: "right",
          numeric: true,
          cell: (row) => <Money value={row.planned} bare dp={0} />,
        },
        ...(anyRollover
          ? [
              {
                key: "carry",
                header: "Carry-in",
                align: "right" as const,
                numeric: true,
                hideBelow: "wide" as const,
                cell: (row: BudgetPerformanceAllocation) =>
                  row.rolloverEnabled ? (
                    <Money value={row.rolloverCarryIn} bare dp={0} sign />
                  ) : (
                    <span className="text-muted">n/a</span>
                  ),
              },
              {
                key: "available",
                header: "Available",
                align: "right" as const,
                numeric: true,
                hideBelow: "wide" as const,
                cell: (row: BudgetPerformanceAllocation) => (
                  <Money value={row.available} bare dp={0} />
                ),
              },
            ]
          : []),
        {
          key: "actual",
          header: "Actual",
          align: "right",
          numeric: true,
          cell: (row) => <Money value={row.actual} bare dp={0} />,
        },
        {
          key: "remaining",
          header: "Remaining",
          align: "right",
          numeric: true,
          cell: (row) => (
            <Money
              value={row.remaining}
              tone={row.remaining < 0 ? "expense" : "income"}
              bare
              dp={0}
            />
          ),
        },
        {
          key: "variance",
          header: "Var",
          align: "right",
          numeric: true,
          hideBelow: "wide",
          cell: (row) =>
            // Null when the base is zero: a percentage of nothing is not 0%,
            // it is unanswerable.
            row.variancePct === null ? (
              <span className="text-muted">n/a</span>
            ) : (
              <span className={row.variancePct < 0 ? "text-expense" : "text-income"}>
                {formatPercent(row.variancePct, { sign: true })}
              </span>
            ),
        },
        {
          key: "projected",
          header: "Projected",
          align: "right",
          numeric: true,
          hideBelow: "wide",
          cell: (row) =>
            row.projectedActual === null ? (
              <span className="text-muted">n/a</span>
            ) : (
              <span className={row.forecastToExceed ? "text-expense" : ""} title={row.projectionBasis}>
                <Money value={row.projectedActual} bare dp={0} />
              </span>
            ),
        },
      ]}
      rows={allocations}
      rowKey={(row) => row.categoryId}
    />
  );
}

/** Flexible money left, spread over the days that remain. */
export function SafeToSpend({ performance }: { performance: BudgetPerformanceData }) {
  const safe = performance.safeToSpend;

  return (
    <Panel title="Safe to spend" meta="flexible allocations only">
      <dl className="m-0 grid grid-cols-[9rem_1fr] text-body">
        <dt className="py-1 text-muted">Flexible left</dt>
        <dd className="m-0 py-1">
          <Money value={safe.remainingFlexible} bare />
        </dd>

        <dt className="py-1 text-muted">Per day</dt>
        <dd className="m-0 py-1">
          {safe.perDay === null ? (
            <span className="text-muted">the month is over</span>
          ) : (
            <Money value={safe.perDay} bare />
          )}
        </dd>

        <dt className="py-1 text-muted">Per week</dt>
        <dd className="m-0 py-1">
          {safe.perWeek === null ? (
            <span className="text-muted">n/a</span>
          ) : (
            <Money value={safe.perWeek} bare />
          )}
        </dd>

        <dt className="py-1 text-muted">Until next income</dt>
        <dd className="m-0 py-1">
          {/* Null means no scheduled income was found, not zero days. */}
          {safe.untilNextIncome === null ? (
            <span className="text-muted">no income scheduled</span>
          ) : (
            <>
              <Money value={safe.untilNextIncome} bare />
              <span className="ml-1 text-label text-muted">
                {safe.daysUntilNextIncome} days, to {safe.nextIncomeDate}
              </span>
            </>
          )}
        </dd>
      </dl>

      <p className="mt-2 text-label text-muted">{safe.basis}</p>
    </Panel>
  );
}
