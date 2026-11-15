import "server-only";
import type { MonthSummary } from "@bt/lib/budget-query-types";
import { shiftMonthKey } from "@bt/lib/credit-account-queries";

/**
 * Helpers for reading a window of months out of budgettracker's
 * `getMonthlySummary`.
 *
 * That query only ever counts back from today, so looking at September from
 * November means asking for enough months to reach it and keeping the window
 * that ends there. Slicing its output rather than writing a second monthly
 * rollup keeps one definition of what a month's income and spend are.
 */

/** Whole months from `from` to `to`, never negative. */
export function monthsApart(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number) as [number, number];
  const [toYear, toMonth] = to.split("-").map(Number) as [number, number];

  return Math.max((toYear - fromYear) * 12 + (toMonth - fromMonth), 0);
}

/**
 * A month the summary cannot hold yet because it has not happened: nothing
 * logged, nothing elapsed. Drawn as an empty month, never as recent figures.
 */
function notYetMonth(monthKey: string): MonthSummary {
  const [year, month] = monthKey.split("-").map(Number) as [number, number];
  const label = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );

  return {
    month: label,
    monthKey,
    income: 0,
    expenses: 0,
    net: 0,
    isPartial: false,
    daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    daysElapsed: 0,
  };
}

/**
 * The `count` months ending at `month`, oldest first, always the requested
 * months and never a substitute window.
 *
 * Months after the newest summary row are still to come (the summary counts
 * back from today), so they come back empty. Months before the oldest row are
 * left out, so a shorter window comes back when history runs out rather than
 * padding with invented zero months: a month that was never recorded is not a
 * month of no spending.
 */
export function monthsEndingAt(
  summary: readonly MonthSummary[],
  month: string,
  count: number,
): MonthSummary[] {
  const byKey = new Map(summary.map((row) => [row.monthKey, row]));
  const newest = summary.at(-1)?.monthKey;

  return Array.from({ length: count }, (_, index) => shiftMonthKey(month, index - count + 1)).flatMap(
    (key) => {
      const row = byKey.get(key);
      if (row) return [row];
      return newest !== undefined && key > newest ? [notYetMonth(key)] : [];
    },
  );
}

/**
 * Whether a month has nothing in it at all.
 *
 * Zero and unknown are different answers, and the local mirror holds months of
 * each. Every view that draws a month has to tell them apart.
 */
export function isEmptyMonth(row: MonthSummary): boolean {
  return row.income === 0 && row.expenses === 0;
}
