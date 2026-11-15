import { DataTable, type Column } from "@/components/ui/data-table";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { describeLateness, formatDayKey } from "@/lib/bills";
import type { BillOccurrence } from "@bt/lib/budget-query-types";
import type { BillTimeline } from "@/server/queries/bills";

const STATUS_LABEL: Record<BillOccurrence["status"], string> = {
  PAID: "Paid",
  SKIPPED: "Skipped",
  SNOOZED: "Snoozed",
};

const COLUMNS: readonly Column<BillOccurrence>[] = [
  {
    key: "due",
    header: "Due",
    numeric: true,
    // Date-only: the stored day, not converted.
    cell: (row) => formatDayKey(row.localDueDate),
  },
  {
    key: "status",
    header: "Outcome",
    cell: (row) => (
      <span className={row.status === "PAID" ? "" : "text-muted"}>
        {STATUS_LABEL[row.status]}
        {row.status === "SNOOZED" && row.localSnoozeUntil
          ? ` to ${formatDayKey(row.localSnoozeUntil)}`
          : ""}
        {row.snoozeCount > 0 && row.status !== "SNOOZED" ? (
          <span className="ml-1 text-label text-muted">
            after {row.snoozeCount} snooze{row.snoozeCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    key: "acted",
    header: "On",
    numeric: true,
    hideBelow: "wide",
    // An instant, so this one *is* the user's own day (`localActionDate`).
    cell: (row) => (row.localActionDate ? formatDayKey(row.localActionDate) : ""),
  },
  {
    key: "late",
    header: "Timing",
    cell: (row) => (
      <span className={row.daysLate !== null && row.daysLate > 0 ? "text-expense" : "text-muted"}>
        {describeLateness(row.daysLate)}
      </span>
    ),
  },
  {
    key: "paid",
    header: "Paid",
    align: "right",
    // What the linked transaction recorded, not the bill's current amount,
    // which an edit since may have rewritten.
    cell: (row) =>
      row.paidAmount === null ? <span className="text-muted">none</span> : <Money value={row.paidAmount} />,
  },
];

function summaryLine({ summary }: BillTimeline): string {
  const parts = [`${summary.paid} paid`];
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
  if (summary.snoozed > 0) parts.push(`${summary.snoozed} snoozed`);
  if (summary.paidLate > 0) parts.push(`${summary.paidLate} late`);
  return parts.join(" · ");
}

function averageLine({ summary }: BillTimeline): string | null {
  if (summary.avgDaysLate === null) return null;
  const average = summary.avgDaysLate;
  const days = Math.abs(average);
  const head =
    average === 0
      ? "on average paid on the day"
      : `on average ${days} day${days === 1 ? "" : "s"} ${average > 0 ? "late" : "early"}`;
  const worst = summary.maxDaysLate ?? 0;
  return worst > 0 ? `${head}, worst ${worst} day${worst === 1 ? "" : "s"} late` : head;
}

/** One bill's occurrences in the window: paid, skipped, snoozed. */
export function HistoryPanel({ timeline }: { timeline: BillTimeline }) {
  const average = averageLine(timeline);

  return (
    <Panel title={timeline.summary.description} meta={summaryLine(timeline)} flush>
      {average ? (
        <p className="m-0 border-b border-rule-2 px-2.5 py-1 text-label text-muted">{average}</p>
      ) : null}
      <DataTable
        columns={COLUMNS}
        rows={timeline.occurrences}
        rowKey={(row) => `${row.billId}:${row.localDueDate}`}
        stickyHeader={false}
        caption={`${timeline.summary.description} history`}
      />
    </Panel>
  );
}
