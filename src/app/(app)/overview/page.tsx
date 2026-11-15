import type { Metadata } from "next";
import { currentMonthKey } from "@bt/lib/credit-account-queries";
import { BurnPanel } from "@/components/overview/burn-panel";
import {
  CategoriesPanel,
  LabelsPanel,
  SourcesPanel,
} from "@/components/overview/breakdown-panels";
import { KpiRow } from "@/components/overview/kpi-row";
import { MonthNav } from "@/components/overview/month-nav";
import { OverBudgetFlag } from "@/components/overview/over-budget-flag";
import { RecentPanel } from "@/components/overview/recent-panel";
import { Kbd } from "@/components/ui/kbd";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { pageTitle } from "@/lib/app";
import { monthLabel, parseMonth } from "@/lib/month-nav";
import { prisma } from "@/server/db";
import { fetchOverview } from "@/server/queries/overview";
import { requireCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: pageTitle("Overview"),
};

/**
 * The month at a glance.
 *
 * A server component that reads live Postgres per request: Cache Components are
 * off for this app, so there is no stale money (docs/plans/00-overview.md). The
 * month comes from `?month=YYYY-MM` and defaults to the user's current month
 * through the vendored `currentMonthKey`, so the default URL always means now.
 */
export default async function OverviewPage({ searchParams }: PageProps<"/overview">) {
  const user = await requireCurrentUser();
  const params = await searchParams;

  const thisMonth = currentMonthKey(user.timezoneOffset);
  const month = parseMonth(params.month) ?? thisMonth;
  const overview = await fetchOverview(prisma, user.id, {
    timezoneOffset: user.timezoneOffset,
    month,
  });

  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-title font-semibold">Overview</h1>
        <MonthNav month={month} currentMonth={thisMonth} />
      </header>

      {overview.isEmpty ? (
        <Panel flush>
          <EmptyState title={`No entries for ${monthLabel(month)}`}>
            {month > thisMonth
              ? "This month has not started yet."
              : "Nothing was logged in this month."}{" "}
            Press <Kbd>n</Kbd> or type into the command bar to add an entry.
          </EmptyState>
        </Panel>
      ) : (
        <>
          {overview.overBudget ? (
            <OverBudgetFlag
              over={overview.overBudget}
              month={month}
              isPartial={overview.progress.isPartial}
            />
          ) : null}

          <KpiRow overview={overview} />

          <div className="grid gap-2.5 desk:grid-cols-[1.6fr_1fr]">
            <BurnPanel
              daily={overview.daily}
              budget={overview.budget}
              daysInMonth={overview.progress.daysInMonth}
            />
            <RecentPanel rows={overview.recent} month={month} />
          </div>

          <div className="grid gap-2.5 desk:grid-cols-3">
            <CategoriesPanel
              categories={overview.categories}
              month={month}
              previousMonth={overview.previousMonth}
              clipped={overview.versusPrevious.throughDay !== null}
            />
            <LabelsPanel labels={overview.labels} month={month} />
            <SourcesPanel sources={overview.sources} month={month} />
          </div>
        </>
      )}
    </div>
  );
}
