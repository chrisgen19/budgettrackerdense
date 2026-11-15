import { Sparkline } from "@/components/charts/sparkline";
import { DataTable, ShareBar, Swatch } from "@/components/ui/data-table";
import { Delta, Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import type { LabelBreakdownItem } from "@bt/lib/budget-query-types";
import { monthShort } from "@/lib/month-nav";
import type { OverviewCategory, OverviewSource } from "@/server/queries/overview";

/**
 * Categories: this month, the change against the previous month, and six
 * months of history.
 *
 * The Δ comes from budgettracker's `getSpendingTrends`, which clips both months
 * to the same day while the current one is running. A part-month against a whole
 * one reads as a saving in every category whose bill has not landed yet.
 */
export function CategoriesPanel({
  categories,
  month,
  previousMonth,
  clipped,
}: {
  categories: readonly OverviewCategory[];
  month: string;
  previousMonth: string;
  clipped: boolean;
}) {
  return (
    <Panel
      title="Categories"
      meta={`${monthShort(month)} / ${monthShort(previousMonth)}${clipped ? " to date" : ""} / 6 mo`}
      flush
    >
      <DataTable<OverviewCategory>
        caption="Spending by category, with the change against the previous month"
        columns={[
          {
            key: "name",
            header: "Category",
            truncate: true,
            cell: (row) => (
              <>
                <Swatch color={row.color} />
                {row.name}
              </>
            ),
          },
          {
            key: "current",
            header: monthShort(month),
            align: "right",
            numeric: true,
            cell: (row) => <Money value={row.current} bare dp={0} />,
          },
          {
            key: "change",
            header: "Δ",
            align: "right",
            numeric: true,
            cell: (row) => <Delta value={row.change} />,
          },
          {
            key: "trend",
            header: "Trend",
            hideBelow: "wide",
            cell: (row) =>
              row.spark.length > 1 ? (
                <Sparkline values={row.spark} height={16} color="var(--accent)" dot={false} />
              ) : null,
          },
        ]}
        rows={categories}
        rowKey={(row) => row.id ?? row.name}
        empty={<EmptyState title="No spending this month" />}
      />
    </Panel>
  );
}

/**
 * Labels. A transaction can carry several, so the shares add to more than 100%
 * and the amounts to more than the month's total; the panel says so rather than
 * normalising the figures into something that adds up but is not true.
 */
export function LabelsPanel({
  labels,
  month,
}: {
  labels: readonly LabelBreakdownItem[];
  month: string;
}) {
  const largest = labels[0]?.amount ?? 1;

  return (
    <Panel title="Labels" meta={`${monthShort(month)}, a row may carry several`} flush>
      <DataTable<LabelBreakdownItem>
        caption="Spending by label"
        columns={[
          {
            key: "name",
            header: "Label",
            truncate: true,
            cell: (row) => (
              <>
                <Swatch color={row.color} />
                {row.name}
              </>
            ),
          },
          {
            key: "count",
            header: "#",
            align: "right",
            numeric: true,
            cell: (row) => <span className="text-muted">{row.transactionCount}</span>,
          },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            numeric: true,
            cell: (row) => <Money value={row.amount} bare dp={0} />,
          },
          {
            key: "share",
            header: "Share",
            hideBelow: "wide",
            cell: (row) => <ShareBar share={row.amount / largest} />,
          },
        ]}
        rows={labels}
        rowKey={(row) => row.id}
        empty={<EmptyState title="Nothing labelled this month" />}
      />
    </Panel>
  );
}

/**
 * Where the money went out from. `owed` and `utilization` are a card's, as at
 * the end of the month shown, so a past month is not paired with today's debt.
 * Cash has neither, and says `n/a` rather than 0.
 */
export function SourcesPanel({
  sources,
  month,
}: {
  sources: readonly OverviewSource[];
  month: string;
}) {
  return (
    <Panel title="Payment sources" meta={`owed as at end of ${monthShort(month)}`} flush>
      <DataTable<OverviewSource>
        caption="Spending and balances by payment source"
        columns={[
          {
            key: "name",
            header: "Source",
            truncate: true,
            cell: (row) => (
              <>
                {row.color ? <Swatch color={row.color} /> : null}
                {row.name}
                {row.dueDay ? <span className="ml-1 text-muted">due {row.dueDay}</span> : null}
              </>
            ),
          },
          {
            key: "spend",
            header: `${monthShort(month)} spend`,
            align: "right",
            numeric: true,
            cell: (row) => <Money value={row.spend} bare dp={0} />,
          },
          {
            key: "owed",
            header: "Owed",
            align: "right",
            numeric: true,
            cell: (row) =>
              row.owed === null ? (
                <span className="text-muted">n/a</span>
              ) : (
                <Money value={row.owed} tone="expense" bare dp={0} />
              ),
          },
          {
            key: "util",
            header: "Util",
            align: "right",
            numeric: true,
            cell: (row) =>
              row.utilization === null ? (
                <span className="text-muted">n/a</span>
              ) : (
                <span className={row.utilization > 80 ? "text-expense" : ""}>
                  {row.utilization.toFixed(1)}%
                </span>
              ),
          },
        ]}
        rows={sources}
        rowKey={(row) => row.id}
        empty={<EmptyState title="No cards or spending recorded" />}
      />
    </Panel>
  );
}
