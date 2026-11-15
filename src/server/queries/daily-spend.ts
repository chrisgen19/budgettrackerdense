/**
 * Per-day expense totals for the burn chart.
 *
 * Every local day in the window appears, including the ones with nothing
 * logged: a burn line that skips empty days slopes as if money were spent on
 * them, and the flat stretches are exactly what the chart is read for. Days
 * after the user's today are left out rather than drawn at zero, which would
 * show the month already finished under budget.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { PeriodParams, ResolvedPeriod } from "@bt/lib/budget-query-types";
import { roundMoney } from "@bt/lib/money";
import { localCalendarDay, shiftCalendarDay } from "@bt/lib/period-progress";
import { resolveWindow } from "./period";

export interface DailySpendParams extends PeriodParams {
  /** `Date.getTimezoneOffset()` minutes, from `users.timezone_offset`. */
  timezoneOffset: number;
  /** Count income instead of expenses. Defaults to expenses. */
  type?: "INCOME" | "EXPENSE";
}

export interface DailySpendDay {
  /** YYYY-MM-DD in the user's timezone. */
  day: string;
  amount: number;
  /** Running total from the window's first day through this one. */
  cumulative: number;
  /** True for the day the window is still accumulating on, the user's today. */
  isToday: boolean;
}

export interface DailySpend {
  period: ResolvedPeriod;
  days: DailySpendDay[];
  total: number;
}

/** Every local day from `from` through `to`, inclusive. */
export function calendarDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = shiftCalendarDay(day, 1)) days.push(day);
  return days;
}

export async function fetchDailySpend(
  prisma: PrismaClient,
  userId: string,
  params: DailySpendParams,
): Promise<DailySpend> {
  const { period, dateFilter } = resolveWindow(params, params.timezoneOffset);
  if (!period.from || !period.to) {
    throw new RangeError("A burn chart needs a closed window: pass `month`, or `from` and `to`.");
  }

  // Read from the clock, not from a parameter: the vendored `describePeriod`
  // behind `resolveWindow` reads it too, and two clocks would let a window
  // report itself finished while the day list still stopped at today.
  const today = localCalendarDay(new Date(), params.timezoneOffset);
  const lastDay = period.to < today ? period.to : today;

  const transactions = await prisma.transaction.findMany({
    where: { userId, type: params.type ?? "EXPENSE", date: dateFilter },
    select: { amount: true, date: true },
  });

  const perDay = new Map<string, number>();
  for (const transaction of transactions) {
    const day = localCalendarDay(transaction.date, params.timezoneOffset);
    perDay.set(day, (perDay.get(day) ?? 0) + transaction.amount);
  }

  let running = 0;
  const days: DailySpendDay[] =
    period.from > lastDay
      ? [] // The whole window is still in the future.
      : calendarDays(period.from, lastDay).map((day) => {
          const amount = perDay.get(day) ?? 0;
          running += amount;
          return {
            day,
            amount: roundMoney(amount),
            cumulative: roundMoney(running),
            isToday: day === today,
          };
        });

  return { period, days, total: roundMoney(running) };
}
