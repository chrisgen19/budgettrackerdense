import Link from "next/link";
import { RowSelection } from "@/components/shell/row-selection";
import { DataTable } from "@/components/ui/data-table";
import { Kbd } from "@/components/ui/kbd";
import { Money } from "@/components/ui/money";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { transactionUrl } from "@/lib/links";
import { monthShort } from "@/lib/month-nav";
import type { LedgerRow } from "@/server/queries/ledger";

/**
 * The last rows of the month. Header hidden the way the mockup's panel is, and
 * wrapped in `RowSelection` so `j`/`k` move through it and Enter opens the row
 * in budgettracker, which still owns editing.
 */
export function RecentPanel({ rows, month }: { rows: readonly LedgerRow[]; month: string }) {
  return (
    <Panel title="Recent" actions={<Kbd>g l</Kbd>} flush>
      <RowSelection>
        <DataTable<LedgerRow>
          caption={`Most recent transactions in ${monthShort(month)}`}
          hideHeader
          columns={[
            {
              key: "date",
              header: "Date",
              cell: (row) => (
                <span className="tnum text-figure text-muted">
                  {monthShort(row.localDate.slice(0, 7))} {row.localDate.slice(8, 10)}
                </span>
              ),
            },
            {
              key: "description",
              header: "Description",
              truncate: true,
              cell: (row) => (
                <Link href={transactionUrl(row.id)} className="hover:underline">
                  {row.description}
                </Link>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              numeric: true,
              cell: (row) => (
                <Money
                  value={row.amount}
                  tone={row.type === "INCOME" ? "income" : "plain"}
                  bare
                  sign={row.type === "INCOME"}
                />
              ),
            },
          ]}
          rows={rows}
          rowKey={(row) => row.id}
          empty={
            <EmptyState title="No transactions this month">
              Press <Kbd>n</Kbd> to add the first one.
            </EmptyState>
          }
        />
      </RowSelection>
    </Panel>
  );
}
