/**
 * Label x month matrix for the Labels page.
 *
 * Follows the same counting rule as budgettracker's `getLabelBreakdown`: a
 * transaction carrying several labels counts **in full** under each, so rows can
 * add to more than the month's total. The unlabeled remainder is a row of its
 * own rather than a gap, because a label table that silently omits it reads as
 * if every peso were tagged.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { roundMoney } from "@bt/lib/money";
import type { TransactionType } from "@bt/lib/budget-query-types";
import {
  type MatrixParams,
  type MatrixRow,
  type MonthMatrix,
  foldMatrix,
  localMonth,
  matrixSpan,
} from "./category-by-month";

/** Id of the catch-all row, matching `getLabelBreakdown`'s `"unlabeled"`. */
export const UNLABELED_ID = "unlabeled";

export interface LabelMatrixParams extends MatrixParams {
  /** Which transactions to count. Defaults to EXPENSE, as the shared breakdown does. */
  type?: TransactionType;
}

/** A label row with how many transactions it covers, beside how much. */
export interface LabelMatrixRow extends MatrixRow {
  /** Transactions per month, same order as `months`. */
  counts: number[];
  count: number;
}

export interface LabelMonthMatrix extends Omit<MonthMatrix, "rows"> {
  rows: LabelMatrixRow[];
}

export async function fetchLabelByMonth(
  prisma: PrismaClient,
  userId: string,
  params: LabelMatrixParams,
): Promise<LabelMonthMatrix> {
  const { months, startDate, endDate } = matrixSpan(params);
  const index = new Map(months.map((month, position) => [month, position]));

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: params.type ?? "EXPENSE",
      date: { gte: startDate, lte: endDate },
    },
    select: {
      amount: true,
      date: true,
      labels: { select: { label: { select: { id: true, name: true, color: true } } } },
    },
  });

  const rows = new Map<string, LabelMatrixRow>();
  const rowFor = (id: string, name: string, color: string): LabelMatrixRow => {
    let row = rows.get(id);
    if (!row) {
      row = {
        id,
        name,
        color,
        icon: "",
        amounts: months.map(() => 0),
        total: 0,
        counts: months.map(() => 0),
        count: 0,
      };
      rows.set(id, row);
    }
    return row;
  };

  for (const transaction of transactions) {
    const column = index.get(localMonth(transaction.date, params.timezoneOffset));
    if (column === undefined) continue;

    const targets =
      transaction.labels.length > 0
        ? transaction.labels.map(({ label }) => label)
        : [{ id: UNLABELED_ID, name: "Unlabeled", color: "#64748b" }];

    for (const label of targets) {
      const row = rowFor(label.id, label.name, label.color);
      row.amounts[column] = (row.amounts[column] ?? 0) + transaction.amount;
      row.total += transaction.amount;
      row.counts[column] = (row.counts[column] ?? 0) + 1;
      row.count += 1;
    }
  }

  const matrix = foldMatrix(months, [...rows.values()]);

  // Column totals from `foldMatrix` would double-count a multi-label row, so they
  // are recomputed over the transactions themselves.
  const monthTotals = months.map(() => 0);
  for (const transaction of transactions) {
    const column = index.get(localMonth(transaction.date, params.timezoneOffset));
    if (column === undefined) continue;
    monthTotals[column] = (monthTotals[column] ?? 0) + transaction.amount;
  }

  return {
    ...matrix,
    monthTotals: monthTotals.map(roundMoney),
    total: roundMoney(monthTotals.reduce((sum, amount) => sum + amount, 0)),
  };
}
