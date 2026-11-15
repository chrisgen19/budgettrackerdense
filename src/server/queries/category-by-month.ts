/**
 * Category x month matrix for the Reports heat table.
 *
 * No shared query returns this shape: `getSpendingByCategory` answers one
 * period at a time, and calling it once per column would resolve twelve
 * windows and twelve queries. This reads the whole span once and folds the rows
 * into the user's own months, using the same local-month formula as the shared
 * queries.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { roundMoney } from "@bt/lib/money";
import { localCalendarDay } from "@bt/lib/period-progress";
import { currentMonthKey, monthWindow } from "@bt/lib/credit-account-queries";
import { monthSpan } from "./period";

export interface MatrixParams {
  /** `Date.getTimezoneOffset()` minutes, from `users.timezone_offset`. */
  timezoneOffset: number;
  /** Newest month in the matrix, YYYY-MM. Defaults to the user's current month. */
  endMonth?: string;
  /** How many months the matrix spans, including `endMonth`. Defaults to 6. */
  months?: number;
}

export interface MatrixRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** One amount per month in `months`, same order, 0 for a month with nothing. */
  amounts: number[];
  total: number;
}

export interface MonthMatrix {
  /** Month keys, oldest first. The last one may still be running. */
  months: string[];
  rows: MatrixRow[];
  /** Column totals, same order as `months`. */
  monthTotals: number[];
  total: number;
}

const DEFAULT_MONTHS = 6;

/** The local month a stored instant falls in, YYYY-MM. */
export function localMonth(instant: Date, timezoneOffset: number): string {
  return localCalendarDay(instant, timezoneOffset).slice(0, 7);
}

/** The months a matrix covers, and the instants bounding the whole span. */
export function matrixSpan(params: MatrixParams): {
  months: string[];
  startDate: Date;
  endDate: Date;
} {
  const endMonth = params.endMonth ?? currentMonthKey(params.timezoneOffset);
  const months = monthSpan(endMonth, params.months ?? DEFAULT_MONTHS);
  const first = months[0] as string;
  const last = months[months.length - 1] as string;

  return {
    months,
    startDate: monthWindow(first, params.timezoneOffset).start,
    endDate: monthWindow(last, params.timezoneOffset).end,
  };
}

/**
 * Expense totals per category per month, largest overall first.
 *
 * Expenses only: income is a handful of rows a month and would dominate the
 * colour scale of a table built to show where money goes.
 */
export async function fetchCategoryByMonth(
  prisma: PrismaClient,
  userId: string,
  params: MatrixParams,
): Promise<MonthMatrix> {
  const { months, startDate, endDate } = matrixSpan(params);
  const index = new Map(months.map((month, position) => [month, position]));

  const transactions = await prisma.transaction.findMany({
    where: { userId, type: "EXPENSE", date: { gte: startDate, lte: endDate } },
    select: {
      amount: true,
      date: true,
      categoryId: true,
      category: { select: { name: true, color: true, icon: true } },
    },
  });

  const rows = new Map<string, MatrixRow>();

  for (const transaction of transactions) {
    const column = index.get(localMonth(transaction.date, params.timezoneOffset));
    if (column === undefined) continue;

    let row = rows.get(transaction.categoryId);
    if (!row) {
      row = {
        id: transaction.categoryId,
        name: transaction.category.name,
        color: transaction.category.color,
        icon: transaction.category.icon,
        amounts: months.map(() => 0),
        total: 0,
      };
      rows.set(transaction.categoryId, row);
    }
    row.amounts[column] = (row.amounts[column] ?? 0) + transaction.amount;
    row.total += transaction.amount;
  }

  return foldMatrix(months, [...rows.values()]);
}

/** Round once per cell and derive the column totals. Shared with the label matrix. */
export function foldMatrix(months: string[], rows: MatrixRow[]): MonthMatrix {
  const monthTotals = months.map(() => 0);

  const rounded = rows
    .sort((a, b) => b.total - a.total)
    .map((row) => {
      row.amounts.forEach((amount, column) => {
        monthTotals[column] = (monthTotals[column] ?? 0) + amount;
      });
      return {
        ...row,
        amounts: row.amounts.map(roundMoney),
        total: roundMoney(row.total),
      };
    });

  return {
    months,
    rows: rounded,
    monthTotals: monthTotals.map(roundMoney),
    total: roundMoney(monthTotals.reduce((sum, amount) => sum + amount, 0)),
  };
}
