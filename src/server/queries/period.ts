/**
 * Window resolution for this app's own queries.
 *
 * Every rule about where a month starts lives in budgettracker: `describePeriod`
 * resolves the caller's period into the user's local days and says whether the
 * window is still running, and `monthWindow` turns a month key into instants.
 * This module only turns those local days back into the UTC instants Prisma
 * filters on, with the one formula the whole app uses:
 * `Date.UTC(y, m, d) + timezoneOffset * 60000`.
 *
 * `timezoneOffset` is always explicit, in `Date.getTimezoneOffset()` minutes, so
 * UTC+8 is -480. Defaulting it silently returns the wrong month.
 */
import { describePeriod, describePeriodOrCurrentMonth } from "@bt/lib/budget-queries";
import type { PeriodParams, ResolvedPeriod } from "@bt/lib/budget-query-types";
import { shiftMonthKey } from "@bt/lib/credit-account-queries";

const LOCAL_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The UTC instant a local `YYYY-MM-DD` begins or ends at, both bounds inclusive. */
export function localDayInstant(day: string, timezoneOffset: number, endOfDay = false): Date {
  const match = LOCAL_DAY.exec(day);
  if (!match) throw new RangeError(`Expected a date as YYYY-MM-DD, got "${day}".`);

  const [year, month, date] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ];
  const base = endOfDay
    ? Date.UTC(year, month - 1, date, 23, 59, 59, 999)
    : Date.UTC(year, month - 1, date);

  return new Date(base + timezoneOffset * 60_000);
}

/** A resolved window: the instants to filter on, and the period to report. */
export interface QueryWindow {
  period: ResolvedPeriod;
  startDate: Date | null;
  endDate: Date | null;
  /** The Prisma `date` predicate, leaving out whichever bound is open. */
  dateFilter: { gte?: Date; lte?: Date };
}

/**
 * Resolve a period the way the shared queries do, then expose its instants.
 *
 * `orCurrentMonth` false means "no period given covers all time", matching
 * `searchTransactions`; true falls back to the user's current month, matching
 * `getBudgetOverview`. Passing both `month` and `from`/`to` throws, as there.
 */
export function resolveWindow(
  params: PeriodParams,
  timezoneOffset: number,
  orCurrentMonth = true,
): QueryWindow {
  const period = orCurrentMonth
    ? describePeriodOrCurrentMonth(params, timezoneOffset)
    : describePeriod(params, timezoneOffset);

  if (!period) {
    return { period: openPeriod(), startDate: null, endDate: null, dateFilter: {} };
  }

  const startDate = period.from ? localDayInstant(period.from, timezoneOffset) : null;
  const endDate = period.to ? localDayInstant(period.to, timezoneOffset, true) : null;

  return {
    period,
    startDate,
    endDate,
    dateFilter: {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    },
  };
}

/** The all-time window, reported as open at both ends and therefore still running. */
function openPeriod(): ResolvedPeriod {
  return {
    month: null,
    from: null,
    to: null,
    isPartial: true,
    daysInPeriod: null,
    daysElapsed: null,
  };
}

/**
 * `count` consecutive month keys ending at `endMonth`, oldest first.
 *
 * The matrix views read left to right in time, and the newest column is the
 * month being reviewed, so the list is anchored at its end rather than its
 * start.
 */
export function monthSpan(endMonth: string, count: number): string[] {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError(`Expected at least one month, got ${count}.`);
  }
  return Array.from({ length: count }, (_, index) => shiftMonthKey(endMonth, index - count + 1));
}
