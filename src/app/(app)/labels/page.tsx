import type { Metadata } from "next";
import Link from "next/link";
import { HeatTable } from "@/components/charts/heat-table";
import { LabelTable } from "@/components/labels/label-table";
import { MonthNav } from "@/components/overview/month-nav";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { pageTitle } from "@/lib/app";
import { labelLedgerHref, labelsUrl } from "@/lib/links";
import { monthLabel, monthShort, parseMonth } from "@/lib/month-nav";
import { currentMonthKey } from "@bt/lib/credit-account-queries";
import { prisma } from "@/server/db";
import { UNLABELED_ID } from "@/server/queries/label-by-month";
import { fetchLabels, type Labels } from "@/server/queries/labels";
import { requireCurrentUser } from "@/server/session";

export const metadata: Metadata = {
  title: pageTitle("Labels"),
};

function ManageLink() {
  return (
    <Link href={labelsUrl()} className="text-accent underline">
      budgettracker
    </Link>
  );
}

/** Why the month has no rows: not started, still empty, or simply not logged. */
function emptyMonthTitle(labels: Labels, thisMonth: string): string {
  const name = monthLabel(labels.month);
  if (labels.month > thisMonth) return `${name} has not started`;
  if (labels.isCurrentMonth) return `Nothing logged in ${name} yet`;
  return `Nothing logged in ${name}`;
}

function SixMonths({ labels }: { labels: Labels }) {
  const months = labels.months.map((key, index) => ({
    label: monthShort(key),
    empty: (labels.monthTotals[index] ?? 0) === 0,
  }));
  const first = labels.months[0] ?? labels.month;

  if (months.every((month) => month.empty)) {
    return (
      <EmptyState
        title={`Nothing logged between ${monthLabel(first)} and ${monthLabel(labels.month)}`}
      />
    );
  }

  return (
    <HeatTable
      rowHeader="Label"
      caption="Spending by label and month"
      months={months}
      rows={labels.rows
        .filter((row) => row.windowTotal > 0)
        .map((row) => ({
          name: row.name,
          color: row.color,
          values: row.trend,
          href: row.id === UNLABELED_ID ? undefined : labelLedgerHref(row.id, labels.month),
        }))}
      summary={[{ label: "Spent", values: labels.monthTotals, emphasis: true }]}
    />
  );
}

/**
 * Labels: each label's month with its count, amount and share, then six months
 * of label by month.
 *
 * Expenses only, matching budgettracker's `getLabelBreakdown` default; every
 * label in the local data is an expense label. A transaction carrying several
 * labels counts in full under each, so nothing here is normalised to add up.
 */
export default async function LabelsPage({ searchParams }: PageProps<"/labels">) {
  const user = await requireCurrentUser();
  const params = await searchParams;

  const thisMonth = currentMonthKey(user.timezoneOffset);
  const month = parseMonth(params.month) ?? thisMonth;

  const labels = await fetchLabels(prisma, user.id, {
    timezoneOffset: user.timezoneOffset,
    month,
  });

  const name = monthLabel(month);

  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-title font-semibold">Labels</h1>
        <MonthNav month={month} currentMonth={thisMonth} basePath="/labels" />
      </header>

      {labels.labelCount === 0 && labels.rows.length === 0 ? (
        <Panel flush>
          <EmptyState title="No labels yet">
            <p>
              Labels are created in <ManageLink />. Tag a transaction with one and it shows here
              by month.
            </p>
          </EmptyState>
        </Panel>
      ) : (
        <>
          <Panel title={name} meta="a row with two labels counts under both" flush>
            {labels.monthTotal === 0 ? (
              <EmptyState title={emptyMonthTitle(labels, thisMonth)}>
                <p>Step back a month, or log something under a label.</p>
              </EmptyState>
            ) : (
              <LabelTable labels={labels} monthLabel={name} />
            )}
          </Panel>

          <Panel title="Six months" meta="dot: nothing logged that month" flush>
            <SixMonths labels={labels} />
          </Panel>
        </>
      )}
    </div>
  );
}
