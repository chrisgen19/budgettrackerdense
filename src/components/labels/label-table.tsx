import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";
import { DataTable, ShareBar, Swatch, type Column } from "@/components/ui/data-table";
import { Money } from "@/components/ui/money";
import { labelLedgerHref } from "@/lib/links";
import { formatPercent } from "@/lib/money";
import { UNLABELED_ID } from "@/server/queries/label-by-month";
import type { LabelRow, Labels } from "@/server/queries/labels";

/** What a label may be put on, said only when it is not the usual expenses. */
const APPLICABLE: Record<string, string> = { INCOME: "income only", BOTH: "income and expense" };

function columns(month: string): Column<LabelRow>[] {
  return [
    {
      key: "label",
      header: "Label",
      truncate: true,
      cell: (row) => (
        <>
          <Swatch color={row.color} />
          {row.id === UNLABELED_ID ? (
            <span className="text-muted">{row.name}</span>
          ) : (
            <Link href={labelLedgerHref(row.id, month)} className="text-ink hover:underline">
              {row.name}
            </Link>
          )}
          {row.applicableTo && APPLICABLE[row.applicableTo] ? (
            <span className="ml-1.5 hidden text-label text-muted wide:inline">
              {APPLICABLE[row.applicableTo]}
            </span>
          ) : null}
        </>
      ),
    },
    {
      key: "count",
      header: "#",
      align: "right",
      numeric: true,
      cell: (row) => <span className="text-muted">{row.count}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (row) => <Money value={row.amount} tone={row.amount === 0 ? "muted" : "plain"} />,
    },
    {
      key: "share",
      header: "Share",
      align: "right",
      cell: (row) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className="hidden wide:inline">
            <ShareBar share={Math.min(row.share, 1)} />
          </span>
          <span className="tnum text-figure text-muted">{formatPercent(row.share)}</span>
        </span>
      ),
    },
    {
      key: "trend",
      header: "6 mo",
      hideBelow: "wide",
      cell: (row) => (
        <Sparkline values={row.trend} color={row.color} label={`${row.name}, six months`} />
      ),
    },
    {
      key: "window",
      header: "6-mo total",
      align: "right",
      hideBelow: "desk",
      cell: (row) => (
        <span className="text-muted">
          <Money value={row.windowTotal} tone="muted" dp={0} />
          <span className="ml-1 text-label">({row.windowCount})</span>
        </span>
      ),
    },
  ];
}

/**
 * Each label's month: how many rows, how much, and what share of everything
 * spent. A row tagged twice counts in full under both, so the shares can add to
 * more than 100% and the footer is the month's real spend, not the column sum.
 */
export function LabelTable({ labels, monthLabel }: { labels: Labels; monthLabel: string }) {
  return (
    <DataTable
      columns={columns(labels.month)}
      rows={labels.rows}
      rowKey={(row) => row.id}
      stickyHeader={false}
      caption={`Spending by label, ${monthLabel}`}
      footer={{
        label: "Spent",
        cells: [
          "",
          <Money key="total" value={labels.monthTotal} />,
          <span key="share" className="text-muted">
            100%
          </span>,
          "",
          "",
        ],
      }}
    />
  );
}
