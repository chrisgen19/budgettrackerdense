import type { Metadata } from "next";
import { HeatTable } from "@/components/charts/heat-table";
import { MonthBars } from "@/components/charts/month-bars";
import { RangeNav } from "@/components/reports/range-nav";
import { Kbd } from "@/components/ui/kbd";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { pageTitle } from "@/lib/app";
import { monthLabel, parseMonth } from "@/lib/month-nav";
import { currentMonthKey } from "@bt/lib/credit-account-queries";
import { prisma } from "@/server/db";
import { fetchReports, parseRange } from "@/server/queries/reports";
import { requireCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: pageTitle("Reports"),
};

/**
 * Income against spend over a range, and where the money went by category.
 *
 * A month that was never logged shows "no data", never a zero: the local
 * mirror holds months of each, and a zero bar says the month was free.
 */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requireCurrentUser();
  const params = await searchParams;

  const thisMonth = currentMonthKey(user.timezoneOffset);
  const endMonth = parseMonth(params.month) ?? thisMonth;
  const range = parseRange(params.months);

  const reports = await fetchReports(prisma, user.id, {
    timezoneOffset: user.timezoneOffset,
    endMonth,
    months: range,
  });

  const { months, matrix, totals } = reports;
  const columns = months.map((month) => ({ label: month.label, empty: month.empty }));
  const spanLabel = `${monthLabel(months[0]?.key ?? endMonth)} to ${monthLabel(endMonth)}`;

  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-title font-semibold">Reports</h1>
        <RangeNav endMonth={endMonth} range={range} currentMonth={thisMonth} />
      </header>

      {reports.isEmpty ? (
        <Panel flush>
          <EmptyState title={`Nothing logged between ${spanLabel}`}>
            Press <Kbd>n</Kbd> to add an entry, or step back to a month that has data.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <Panel
            title={`Income / spend, ${range} months`}
            meta={
              reports.emptyMonths.length > 0
                ? `${reports.emptyMonths.join(", ")} not logged`
                : "bars: income, spend"
            }
            actions={
              <span className="hidden wide:flex items-center gap-2">
                <span>
                  in <Money value={totals.income} tone="income" bare dp={0} />
                </span>
                <span>
                  out <Money value={-totals.expenses} bare dp={0} />
                </span>
                <span>
                  net{" "}
                  <Money
                    value={totals.net}
                    tone={totals.net < 0 ? "expense" : "income"}
                    bare
                    dp={0}
                    sign
                  />
                </span>
              </span>
            }
          >
            <MonthBars
              months={months.map((month) => ({
                label: month.label,
                income: month.income,
                expense: month.expenses,
                empty: month.empty,
              }))}
            />
          </Panel>

          <Panel
            title="Category × month"
            meta="cell shade = share of the largest cell"
            flush
          >
            {matrix.rows.length === 0 ? (
              <EmptyState title="No spending in this range">
                Income was logged, but nothing was spent.
              </EmptyState>
            ) : (
              <HeatTable
                caption={`Spending by category, ${spanLabel}`}
                rows={matrix.rows.map((row) => ({
                  name: row.name,
                  color: row.color,
                  values: row.amounts,
                }))}
                months={columns}
                summary={[
                  {
                    label: "Total spend",
                    values: months.map((month) => month.expenses),
                    emphasis: true,
                  },
                  {
                    label: "Income",
                    values: months.map((month) => month.income),
                    tone: "income",
                  },
                  {
                    label: "Net",
                    values: months.map((month) => month.net),
                    tone: "signed",
                    emptyText: "no data",
                  },
                ]}
              />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
