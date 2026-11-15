import "server-only";
import type { MonthSummary } from "@bt/lib/budget-query-types";

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
 * The `count` months ending at `month`, oldest first.
 *
 * A shorter window comes back when history runs out, rather than padding with
 * invented zero months: a month that was never recorded is not a month of no
 * spending.
 */
export function monthsEndingAt(
  summary: readonly MonthSummary[],
  month: string,
  count: number,
): MonthSummary[] {
  const end = summary.findIndex((row) => row.monthKey === month);
  if (end === -1) return summary.slice(-count);

  return summary.slice(Math.max(end + 1 - count, 0), end + 1);
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
