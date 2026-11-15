import type { Metadata } from "next";
import Link from "next/link";
import {
  AllocationsTable,
  PlanTotals,
  SafeToSpend,
} from "@/components/budgets/plan";
import { NoPlan } from "@/components/budgets/no-plan";
import { MonthNav } from "@/components/overview/month-nav";
import { Panel } from "@/components/ui/panel";
import { pageTitle } from "@/lib/app";
import { budgetEditorUrl } from "@/lib/links";
import { parseMonth } from "@/lib/month-nav";
import { currentMonthKey } from "@bt/lib/credit-account-queries";
import { prisma } from "@/server/db";
import { fetchBudgets } from "@/server/queries/budgets";
import { requireCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: pageTitle("Budgets"),
};

/**
 * The month's plan against what actually happened.
 *
 * Read-only: budgettracker owns editing a plan, and every figure here comes
 * from its `getBudgetPerformance`. With no plan for the month, the figures that
 * depend on one are omitted rather than shown as zeros -- see
 * `src/components/budgets/no-plan.tsx` for why that distinction matters.
 */
export default async function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  const user = await requireCurrentUser();
  const params = await searchParams;

  const thisMonth = currentMonthKey(user.timezoneOffset);
  const month = parseMonth(params.month) ?? thisMonth;

  const budgets = await fetchBudgets(prisma, user.id, {
    timezoneOffset: user.timezoneOffset,
    month,
  });

  const { performance } = budgets;

  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-title font-semibold">Budgets</h1>
        <MonthNav month={month} currentMonth={thisMonth} basePath="/budgets" />
      </header>

      {budgets.hasNoPlan ? (
        <NoPlan budgets={budgets} />
      ) : (
        <>
          <PlanTotals performance={performance} />

          <Panel
            title="Allocations"
            meta={`${performance.allocations.length} categor${
              performance.allocations.length === 1 ? "y" : "ies"
            }`}
            flush
          >
            <AllocationsTable performance={performance} />
          </Panel>

          <div className="grid gap-2.5 desk:grid-cols-[1fr_1fr]">
            <SafeToSpend performance={performance} />

            <Panel title="How these figures are counted">
              <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-body">
                {performance.treatmentNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Panel>
          </div>

          {performance.plan ? (
            <Panel
              title="Plan"
              meta={`revision ${performance.plan.revision} of ${performance.plan.revisionCount}`}
            >
              <ol className="m-0 flex list-none flex-col gap-1 p-0 text-body">
                {performance.plan.history.map((revision) => (
                  <li key={revision.id} className="flex items-baseline justify-between gap-3">
                    <span>Revision {revision.revision}</span>
                    <span className="tnum text-figure text-muted">
                      {revision.createdAt.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ol>

              <p className="mt-2 text-label text-muted">
                Plans are edited in{" "}
                <Link href={budgetEditorUrl()} className="text-accent underline">
                  budgettracker
                </Link>
                .
              </p>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
