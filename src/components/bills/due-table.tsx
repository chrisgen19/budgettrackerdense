import { DataTable, Swatch, type Column, type TableSection } from "@/components/ui/data-table";
import { Money } from "@/components/ui/money";
import {
  describeDaysUntil,
  describeEstimateBasis,
  describeReminder,
  formatDayKey,
} from "@/lib/bills";
import type { Bills, DueBill, DueGroup } from "@/server/queries/bills";

/**
 * A figure that may be an estimate. A variable bill's amount is derived from
 * its past payments, so it reads "about": stated flat it would be the kind of
 * assertion budgettracker's #217 marked variable bills to stop.
 */
function BillAmount({ value, isEstimate }: { value: number; isEstimate: boolean }) {
  return (
    <>
      {isEstimate ? (
        <span className="mr-1 text-label text-muted">
          {/* "≈" on a phone, where the word pushes the amount off-screen. */}
          <span aria-hidden className="wide:hidden">≈</span>
          <span className="sr-only wide:not-sr-only">about</span>
        </span>
      ) : null}
      <Money value={value} />
    </>
  );
}

const COLUMNS: readonly Column<DueBill>[] = [
  {
    key: "bill",
    header: "Bill",
    truncate: true,
    cell: (bill) => (
      <>
        <Swatch color={bill.categoryColor} />
        {/* Capped on a phone so When and Amount stay on screen. */}
        <span className="inline-block max-w-[112px] truncate align-bottom wide:max-w-none" title={bill.description}>
          {bill.description}
        </span>
        <span className="ml-1.5 hidden text-label text-muted wide:inline">{bill.categoryName}</span>
      </>
    ),
  },
  {
    key: "due",
    header: "Due",
    numeric: true,
    hideBelow: "wide",
    // The stored calendar day, never shifted by the user's offset.
    cell: (bill) => formatDayKey(bill.localDueDate),
  },
  {
    key: "when",
    header: "When",
    cell: (bill) => (
      <span className={bill.isOverdue ? "font-medium text-expense" : "text-muted"}>
        {describeDaysUntil(bill.daysUntil)}
      </span>
    ),
  },
  {
    key: "reminder",
    header: "Reminder",
    hideBelow: "desk",
    cell: (bill) => <span className="text-muted">{describeReminder(bill.reminderDaysBefore)}</span>,
  },
  {
    key: "basis",
    header: "Amount from",
    hideBelow: "desk",
    cell: (bill) => <span className="text-muted">{describeEstimateBasis(bill.estimateBasis)}</span>,
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    cell: (bill) => <BillAmount value={bill.amount} isEstimate={bill.isEstimate} />,
  },
];

function section(key: string, label: string, group: DueGroup): TableSection<DueBill> {
  return {
    key,
    label: `${label} · ${group.bills.length}`,
    total: <BillAmount value={group.total} isEstimate={group.isEstimate} />,
    rows: group.bills,
  };
}

/** Overdue first, then what falls due inside the window, each with its subtotal. */
export function DueTable({ bills }: { bills: Bills }) {
  const sections = [
    bills.overdue.bills.length > 0 ? section("overdue", "Overdue", bills.overdue) : null,
    bills.upcoming.bills.length > 0
      ? section("upcoming", `Next ${bills.days} days`, bills.upcoming)
      : null,
  ].filter((entry): entry is TableSection<DueBill> => entry !== null);

  return (
    <DataTable
      columns={COLUMNS}
      sections={sections}
      rowKey={(bill) => bill.id}
      caption="Bills overdue and due soon"
    />
  );
}
