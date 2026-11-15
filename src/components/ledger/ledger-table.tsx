import Link from "next/link";
import { RowSelection } from "@/components/shell/row-selection";
import { DataTable, Swatch, Token } from "@/components/ui/data-table";
import { Money } from "@/components/ui/money";
import type { LedgerDay, LedgerRow } from "@/server/queries/ledger";
import { type LedgerFilters, detailHref } from "@/lib/ledger-filters";

/** `Wednesday, Sep 28` for a day heading. */
function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** Local time of day, HH:mm, from the stored instant. */
function localTime(date: Date, timezoneOffset: number): string {
  return new Date(date.getTime() - timezoneOffset * 60_000).toISOString().slice(11, 16);
}

/**
 * The ledger table: rows grouped by the user's own calendar day, each group
 * carrying its own subtotal.
 *
 * Wrapped in `RowSelection`, so `j` and `k` move the highlight and Enter opens
 * the row. The description is a link to `?tx=`, which is both what Enter
 * activates and what makes a row shareable.
 */
export function LedgerTable({
  days,
  filters,
  timezoneOffset,
}: {
  days: readonly LedgerDay[];
  filters: LedgerFilters;
  timezoneOffset: number;
}) {
  return (
    <RowSelection>
      <DataTable<LedgerRow>
        caption="Transactions, grouped by day"
        columns={[
          {
            key: "time",
            header: "Time",
            cell: (row) => (
              <span className="tnum text-figure text-muted">
                {localTime(row.date, timezoneOffset)}
              </span>
            ),
          },
          {
            key: "description",
            header: "Description",
            truncate: true,
            // The link Enter activates, and what makes a row shareable.
            cell: (row) => (
              <Link href={detailHref(filters, row.id)} className="hover:underline">
                {row.description}
              </Link>
            ),
          },
          {
            key: "category",
            header: "Category",
            cell: (row) => (
              <>
                <Swatch color={row.categoryColor} />
                {row.categoryName}
              </>
            ),
          },
          {
            key: "labels",
            header: "Labels",
            hideBelow: "wide",
            cell: (row) => row.labels.map((label) => <Token key={label.id}>{label.name}</Token>),
          },
          {
            key: "source",
            header: "Source",
            hideBelow: "wide",
            cell: (row) => (
              <span className="text-muted">{row.creditAccountName ?? "Cash"}</span>
            ),
          },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            numeric: true,
            cell: (row) => (
              <Money
                value={row.type === "INCOME" ? row.amount : -row.amount}
                tone={row.type === "INCOME" ? "income" : "plain"}
                bare
                sign={row.type === "INCOME"}
              />
            ),
          },
        ]}
        sections={days.map((day) => ({
          key: day.day,
          label: dayLabel(day.day),
          total: (
            <>
              {day.income > 0 ? (
                <Money value={day.income} tone="income" bare sign />
              ) : null}
              {day.income > 0 && day.expenses > 0 ? <span className="mx-1">/</span> : null}
              {day.expenses > 0 ? <Money value={-day.expenses} bare /> : null}
            </>
          ),
          rows: day.rows,
        }))}
        rowKey={(row) => row.id}
      />
    </RowSelection>
  );
}
