import Link from "next/link";
import { Kpi, KpiStrip } from "@/components/ui/kpi-strip";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { budgetEditorUrl } from "@/lib/links";
import { formatPercent } from "@/lib/money";
import type { Budgets } from "@/server/queries/budgets";

/**
 * The month has no `BudgetPlan`.
 *
 * Everything the plan would have produced is left out, not zeroed. Without a
 * plan `getBudgetPerformance` still returns `plannedExpenses: 0` and so
 * `remainingExpenses: -81,578.35`, and safe-to-spend of 0 per day -- all of
 * them arithmetic on a plan that does not exist. Printed, they read as a budget
 * of nothing that has been blown, which is a different and much worse claim
 * than "no budget was set" (docs/plans/06-pages.md).
 *
 * What is shown instead is only what is true without a plan: what came in, what
 * went out, and how far through the month it is.
 */
export function NoPlan({ budgets }: { budgets: Budgets }) {
  const { performance, lastPlan } = budgets;
  const { totals, progress } = performance;

  return (
    <>
      <Panel flush>
        <EmptyState title={`No budget plan for ${performance.periodLabel}`}>
          <p>
            {lastPlan ? (
              <>
                The last plan was for {lastPlan.label}:{" "}
                <Money value={lastPlan.plannedExpenses} bare dp={0} /> across{" "}
                {lastPlan.allocations} categor{lastPlan.allocations === 1 ? "y" : "ies"}.
              </>
            ) : (
              "No plan has been saved for any month yet."
            )}
          </p>
          <p className="mt-2">
            <Link href={budgetEditorUrl()} className="text-accent underline">
              Set a plan in budgettracker
            </Link>
            , then this page fills in.
          </p>
        </EmptyState>
      </Panel>

      <Panel title="What is known without a plan" meta="no plan needed for these">
        <KpiStrip>
          <Kpi
            label="Income"
            value={<Money value={totals.actualIncome} tone="income" bare />}
            note="logged this month"
          />
          <Kpi
            label="Spent"
            value={<Money value={totals.actualExpenses} bare />}
            note="all of it unbudgeted"
          />
          <Kpi
            label="Net"
            value={
              <Money
                value={totals.actualIncome - totals.actualExpenses}
                tone={totals.actualIncome - totals.actualExpenses < 0 ? "expense" : "income"}
                bare
                sign
              />
            }
          />
          <Kpi
            label="Month"
            value={
              <span className="tnum">
                {progress.daysElapsed}/{progress.daysInMonth}
              </span>
            }
            note={`${formatPercent(progress.percentElapsed / 100)} elapsed`}
          />
        </KpiStrip>

        <p className="mt-2 text-label text-muted">
          Planned, remaining, projected and safe-to-spend all need a plan, so they are left out
          rather than shown as zeros.
        </p>
      </Panel>
    </>
  );
}
