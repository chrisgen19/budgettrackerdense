import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getMonthlySummary } from "@bt/lib/budget-queries";
import { currentMonthKey } from "@bt/lib/credit-account-queries";
import type { MonthSummary } from "@bt/lib/budget-query-types";
import { roundMoney } from "@bt/lib/money";
import { type MonthMatrix, fetchCategoryByMonth } from "./category-by-month";
import { isEmptyMonth, monthsApart, monthsEndingAt } from "./monthly";

/**
 * The Reports page: income against spend over a range, and the category x month
 * matrix underneath it.
 *
 * Both halves read the same window so the matrix columns and the bars line up.
 * The monthly totals come from budgettracker's `getMonthlySummary` and the
 * matrix from this app's `fetchCategoryByMonth`, which answers a shape no
 * shared query returns: calling `getSpendingByCategory` once per column would
 * resolve twelve windows and run twelve queries.
 *
 * `timezoneOffset` is threaded explicitly into both. The vendored queries
 * default it to UTC, which moves a UTC+8 user's late-evening rows into the
 * neighbouring month and so into the wrong column.
 */

/** The ranges the page offers, as the plan specifies. */
export const RANGE_OPTIONS = [3, 6, 12] as const;

export type RangeOption = (typeof RANGE_OPTIONS)[number];

export const DEFAULT_RANGE: RangeOption = 6;

/** Narrows a `searchParams` value to one of the offered ranges. */
export function parseRange(value: string | string[] | undefined): RangeOption {
  const text = Array.isArray(value) ? value[0] : value;
  const parsed = Number(text);

  return (RANGE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as RangeOption)
    : DEFAULT_RANGE;
}

export interface ReportsParams {
  /** `Date.getTimezoneOffset()` minutes, from `users.timezone_offset`. UTC+8 is -480. */
  timezoneOffset: number;
  /** Newest month in the range, `YYYY-MM`. Defaults to the user's current month. */
  endMonth?: string;
  /** How many months the range spans, including `endMonth`. */
  months?: RangeOption;
}

export interface ReportsMonth {
  key: string;
  /** Short label for a column header and a bar, e.g. `Sep`. */
  label: string;
  income: number;
  expenses: number;
  net: number;
  /** Nothing at all was logged. Never drawn as a zero. */
  empty: boolean;
  /** The month is still running, so its totals are a floor. */
  isPartial: boolean;
}

export interface Reports {
  endMonth: string;
  range: RangeOption;
  isCurrentMonth: boolean;
  months: ReportsMonth[];
  matrix: MonthMatrix;
  /** Column totals, in the same order as `months`. */
  totals: { income: number; expenses: number; net: number };
  /** Every month in the range is empty. */
  isEmpty: boolean;
  /** Months that had nothing logged, by label, for the panel meta. */
  emptyMonths: string[];
}

/** The short month name for a `YYYY-MM` key, read literally in UTC. */
function shortLabel(month: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

function toReportsMonth(row: MonthSummary): ReportsMonth {
  return {
    key: row.monthKey,
    label: shortLabel(row.monthKey),
    income: row.income,
    expenses: row.expenses,
    net: row.net,
    empty: isEmptyMonth(row),
    isPartial: row.isPartial,
  };
}

export async function fetchReports(
  prisma: PrismaClient,
  userId: string,
  params: ReportsParams,
): Promise<Reports> {
  const { timezoneOffset } = params;
  const thisMonth = currentMonthKey(timezoneOffset);
  const endMonth = params.endMonth ?? thisMonth;
  const range = params.months ?? DEFAULT_RANGE;

  const [summary, matrix] = await Promise.all([
    getMonthlySummary(prisma, userId, {
      months: monthsApart(endMonth, thisMonth) + range,
      timezoneOffset,
    }),
    fetchCategoryByMonth(prisma, userId, { endMonth, months: range, timezoneOffset }),
  ]);

  const months = monthsEndingAt(summary, endMonth, range).map(toReportsMonth);
  const counted = months.filter((month) => !month.empty);

  const sum = (pick: (month: ReportsMonth) => number) =>
    roundMoney(counted.reduce((total, month) => total + pick(month), 0));

  return {
    endMonth,
    range,
    isCurrentMonth: endMonth === thisMonth,
    months,
    matrix,
    totals: {
      income: sum((month) => month.income),
      expenses: sum((month) => month.expenses),
      net: sum((month) => month.net),
    },
    isEmpty: counted.length === 0,
    emptyMonths: months.filter((month) => month.empty).map((month) => month.label),
  };
}
