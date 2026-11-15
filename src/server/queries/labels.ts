import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getLabelList } from "@bt/lib/budget-queries";
import type { LabelItem } from "@bt/lib/budget-query-types";
import { currentMonthKey } from "@bt/lib/credit-account-queries";
import {
  UNLABELED_ID,
  fetchLabelByMonth,
  type LabelMonthMatrix,
} from "./label-by-month";

/**
 * The Labels page: each label's month, its share of the month's spend, and six
 * months of trend.
 *
 * Amounts and counts come from this app's `fetchLabelByMonth`, which follows
 * budgettracker's `getLabelBreakdown` rule: a transaction carrying several
 * labels counts **in full** under each, so the rows can add to more than the
 * month and the shares to more than 100%. Shares are against everything spent
 * that month, labelled or not, which is the same denominator
 * `getLabelBreakdown` uses.
 *
 * Colours and `applicableTo` come from budgettracker's `getLabelList`, which
 * also brings in labels with nothing in the window: a label nobody used this
 * month is an answer, and leaving it out reads as if it did not exist.
 *
 * `timezoneOffset` goes into the matrix explicitly. Defaulted to UTC, a UTC+8
 * user's late-evening rows land in the neighbouring month.
 */

/** How many months the trend and the matrix cover, ending at the month shown. */
export const LABEL_WINDOW = 6;

export interface LabelRow {
  /** A label id, or `"unlabeled"` for the catch-all row. */
  id: string;
  name: string;
  color: string;
  /** EXPENSE, INCOME or BOTH. Null for the unlabeled row. */
  applicableTo: string | null;
  /** In the month shown. */
  count: number;
  amount: number;
  /** Of everything spent in the month, 0 to 1 (can exceed 1 only by rounding). */
  share: number;
  /** One amount per month in the window, oldest first. */
  trend: number[];
  windowTotal: number;
  windowCount: number;
}

export interface Labels {
  month: string;
  isCurrentMonth: boolean;
  /** The window's month keys, oldest first; the last is `month`. */
  months: string[];
  /** Everything spent each month, labelled or not, same order as `months`. */
  monthTotals: number[];
  /** Everything spent in the month shown. */
  monthTotal: number;
  rows: LabelRow[];
  /** Number of labels the user has, from `getLabelList`. Zero is the page's empty state. */
  labelCount: number;
}

/**
 * Merge the matrix with the label list into one row per label, plus the
 * unlabeled remainder when there is any. Ordered by the month's amount, then
 * the window's, then name, so the month's biggest sits on top and unused labels
 * sink to the bottom in a stable order.
 */
export const buildLabelRows = (matrix: LabelMonthMatrix, labels: LabelItem[]): LabelRow[] => {
  const last = matrix.months.length - 1;
  const monthTotal = matrix.monthTotals[last] ?? 0;
  const byId = new Map(matrix.rows.map((row) => [row.id, row]));

  const toRow = (
    id: string,
    name: string,
    color: string,
    applicableTo: string | null,
  ): LabelRow => {
    const found = byId.get(id);
    const amount = found?.amounts[last] ?? 0;
    return {
      id,
      name,
      color,
      applicableTo,
      count: found?.counts[last] ?? 0,
      amount,
      share: monthTotal > 0 ? amount / monthTotal : 0,
      trend: found?.amounts ?? matrix.months.map(() => 0),
      windowTotal: found?.total ?? 0,
      windowCount: found?.count ?? 0,
    };
  };

  const rows = labels.map((label) => toRow(label.id, label.name, label.color, label.applicableTo));

  // A label deleted since its rows were tagged still shows in the matrix; keep it.
  for (const row of matrix.rows) {
    if (row.id !== UNLABELED_ID && !labels.some((label) => label.id === row.id)) {
      rows.push(toRow(row.id, row.name, row.color, null));
    }
  }

  rows.sort(
    (a, b) => b.amount - a.amount || b.windowTotal - a.windowTotal || a.name.localeCompare(b.name),
  );

  const unlabeled = byId.get(UNLABELED_ID);
  if (unlabeled) rows.push(toRow(UNLABELED_ID, "Unlabeled", unlabeled.color, null));

  return rows;
};

export async function fetchLabels(
  prisma: PrismaClient,
  userId: string,
  { timezoneOffset, month }: { timezoneOffset: number; month?: string },
): Promise<Labels> {
  const thisMonth = currentMonthKey(timezoneOffset);
  const key = month ?? thisMonth;

  const [matrix, labels] = await Promise.all([
    fetchLabelByMonth(prisma, userId, { timezoneOffset, endMonth: key, months: LABEL_WINDOW }),
    getLabelList(prisma, userId),
  ]);

  return {
    month: key,
    isCurrentMonth: key === thisMonth,
    months: matrix.months,
    monthTotals: matrix.monthTotals,
    monthTotal: matrix.monthTotals[matrix.months.length - 1] ?? 0,
    rows: buildLabelRows(matrix, labels),
    labelCount: labels.length,
  };
}
