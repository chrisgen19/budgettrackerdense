import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getLabelBreakdown, getMonthlySummary, getSpendingTrends } from "@bt/lib/budget-queries";
import { getBudgetPerformance } from "@bt/lib/budget-plans";
import {
  type CreditAccountSummary,
  currentMonthKey,
  getCreditAccountSummaries,
  monthWindow,
  shiftMonthKey,
} from "@bt/lib/credit-account-queries";
import { roundMoney } from "@bt/lib/money";
import type { LabelBreakdownItem, MonthSummary } from "@bt/lib/budget-query-types";
import { fetchCategoryByMonth } from "./category-by-month";
import { monthsApart, monthsEndingAt } from "./monthly";
import { type DailySpend, fetchDailySpend } from "./daily-spend";
import { type LedgerRow, fetchLedger } from "./ledger";

/**
 * Everything the Overview page draws, read in one place.
 *
 * Nothing here derives a rule that budgettracker already owns. The month's
 * income and spend come from its `getMonthlySummary`, the month-on-month delta
 * from its `getSpendingTrends` (which clips both months to the same day, so a
 * month in progress is not compared against a whole one), and the plan from its
 * `getBudgetPerformance`. Only the shapes the shared queries do not return --
 * the per-day burn series, the six-month category matrix behind the sparklines,
 * and per-source spend -- come from this app's own queries.
 *
 * `timezoneOffset` is threaded explicitly into every call. The vendored queries
 * default it to UTC when it is missing, which silently returns the wrong month.
 */

/** Months of history behind the sparklines and the category trend lines. */
const SPARK_MONTHS = 6;

/** Rows in the Recent panel, as in the mockup. */
const RECENT_ROWS = 9;

export interface OverviewParams {
  /** `Date.getTimezoneOffset()` minutes, from `users.timezone_offset`. UTC+8 is -480. */
  timezoneOffset: number;
  /** `YYYY-MM`. Defaults to the user's current month. */
  month?: string;
}

/** A category row: this month, the comparable previous month, and six months of history. */
export interface OverviewCategory {
  id: string | null;
  name: string;
  color: string;
  current: number;
  previous: number;
  change: number;
  /** Six monthly totals, oldest first. Empty when the category is new. */
  spark: number[];
}

export interface OverviewSource {
  id: string;
  name: string;
  color: string | null;
  /** Statement due day, for cards. */
  dueDay: number | null;
  /** This month's spend on this source. */
  spend: number;
  /** What the card owes as at the end of the month shown. `null` for cash. */
  owed: number | null;
  utilization: number | null;
}

/**
 * The plan's figures, or `null` when no `BudgetPlan` exists for the month.
 * `null` means the Budget and Remaining KPIs and the chart's budget line are
 * left out, never filled with an average (docs/plans/06-pages.md).
 */
export interface OverviewBudget {
  planned: number;
  remaining: number;
  /** Share of the plan spent, or `null` when the plan sets no expense budget (nothing to divide by). */
  usedPct: number | null;
  /** Straight-line spend per day the plan allows. */
  pace: number;
}

export interface OverviewOverBudget {
  amountOver: number;
  /** The local day the running total first passed the plan, `YYYY-MM-DD`. */
  dayCrossed: string | null;
  projected: number;
  /** Projected month end over plan, as a ratio: 0.11 is 11% over. `null` against a zero plan. */
  overBy: number | null;
}

/**
 * The plan's figures for the month. Only plan existence decides "no plan": a
 * plan with no expense allocations is a plan of zero, so any spend is over it.
 */
export function planFigures(
  hasPlan: boolean,
  planned: number,
  spent: number,
  daysInMonth: number,
): OverviewBudget | null {
  if (!hasPlan) return null;

  return {
    planned,
    remaining: roundMoney(planned - spent),
    usedPct: planned > 0 ? spent / planned : null,
    pace: roundMoney(planned / daysInMonth),
  };
}

/** How far over the plan the month is, or `null` while within it. */
export function overBudgetFigures(
  budget: OverviewBudget | null,
  spent: number,
  projected: number | null,
  dayCrossed: string | null,
): OverviewOverBudget | null {
  if (!budget || spent <= budget.planned) return null;

  const landing = projected ?? spent;
  return {
    amountOver: roundMoney(spent - budget.planned),
    dayCrossed,
    projected: landing,
    overBy: budget.planned > 0 ? landing / budget.planned - 1 : null,
  };
}

export interface Overview {
  month: string;
  monthLabel: string;
  previousMonth: string;
  isCurrentMonth: boolean;
  progress: { daysElapsed: number; daysInMonth: number; isPartial: boolean };
  income: number;
  spent: number;
  net: number;
  /** Spend per day so far. */
  burnPerDay: number;
  /** Projected month-end spend, or `null` for a month that has not started. */
  projected: number | null;
  /** How this month's spend compares with the previous one, same days counted. */
  versusPrevious: { change: number; previousTotal: number; throughDay: number | null };
  budget: OverviewBudget | null;
  overBudget: OverviewOverBudget | null;
  /** Six months ending at `month`, oldest first. */
  monthly: MonthSummary[];
  daily: DailySpend;
  categories: OverviewCategory[];
  labels: LabelBreakdownItem[];
  sources: OverviewSource[];
  recent: LedgerRow[];
  /** Nothing was logged in this month at all. */
  isEmpty: boolean;
}

/** Spend per source: one ledger total per card, plus everything with no card. */
async function fetchSources(
  prisma: PrismaClient,
  userId: string,
  month: string,
  timezoneOffset: number,
  cards: CreditAccountSummary[],
): Promise<OverviewSource[]> {
  const totalsFor = async (creditAccountId: string | "none") => {
    const ledger = await fetchLedger(prisma, userId, {
      month,
      timezoneOffset,
      type: "EXPENSE",
      creditAccountId,
      limit: 1,
    });
    return ledger.totals.expenses;
  };

  const [cashSpend, cardSpends] = await Promise.all([
    totalsFor("none"),
    Promise.all(cards.map((card) => totalsFor(card.id))),
  ]);

  return [
    {
      id: "cash",
      name: "Cash / debit",
      color: null,
      dueDay: null,
      spend: cashSpend,
      owed: null,
      utilization: null,
    },
    ...cards.map((card, index) => ({
      id: card.id,
      name: card.name,
      color: card.color,
      dueDay: card.dueDay,
      spend: cardSpends[index] ?? 0,
      owed: card.balance,
      utilization: card.utilization,
    })),
  ];
}

/** Join the clipped month-on-month trend onto the colours and history of the matrix. */
function buildCategories(
  trends: Awaited<ReturnType<typeof getSpendingTrends>>,
  matrix: Awaited<ReturnType<typeof fetchCategoryByMonth>>,
): OverviewCategory[] {
  const byName = new Map(matrix.rows.map((row) => [row.name, row]));

  return trends.byCategory
    .filter((category) => category.current > 0 || category.previous > 0)
    .map((category) => {
      const row = byName.get(category.name);
      return {
        id: row?.id ?? null,
        name: category.name,
        color: row?.color ?? "var(--muted)",
        current: category.current,
        previous: category.previous,
        change: category.change,
        spark: row?.amounts ?? [],
      };
    })
    .sort((a, b) => b.current - a.current);
}

export async function fetchOverview(
  prisma: PrismaClient,
  userId: string,
  params: OverviewParams,
): Promise<Overview> {
  const { timezoneOffset } = params;
  const thisMonth = currentMonthKey(timezoneOffset);
  const month = params.month ?? thisMonth;
  const previousMonth = shiftMonthKey(month, -1);

  const [summary, budget, trends, matrix, daily, labels, cards, ledger] = await Promise.all([
    getMonthlySummary(prisma, userId, {
      months: monthsApart(month, thisMonth) + SPARK_MONTHS,
      timezoneOffset,
    }),
    getBudgetPerformance(userId, month, timezoneOffset),
    getSpendingTrends(prisma, userId, { currentMonth: month, previousMonth, timezoneOffset }),
    fetchCategoryByMonth(prisma, userId, { endMonth: month, months: SPARK_MONTHS, timezoneOffset }),
    fetchDailySpend(prisma, userId, { month, timezoneOffset }),
    getLabelBreakdown(prisma, userId, { month, timezoneOffset, type: "EXPENSE" }),
    getCreditAccountSummaries(prisma, userId, { asOf: monthWindow(month, timezoneOffset).end }),
    fetchLedger(prisma, userId, { month, timezoneOffset, limit: RECENT_ROWS }),
  ]);

  const monthly = monthsEndingAt(summary, month, SPARK_MONTHS);
  const row = monthly.find((entry) => entry.monthKey === month);
  const income = row?.income ?? 0;
  const spent = row?.expenses ?? 0;
  const { daysElapsed, daysInMonth, isPartial } = budget.progress;

  const burnPerDay = daysElapsed > 0 ? roundMoney(spent / daysElapsed) : 0;
  const projected = daysElapsed > 0 ? roundMoney((spent / daysElapsed) * daysInMonth) : null;

  // `plan === null` is the whole test: no plan, no budget figures anywhere.
  const overview = planFigures(Boolean(budget.plan), budget.totals.plannedExpenses, spent, daysInMonth);
  const overBudget = overBudgetFigures(
    overview,
    spent,
    projected,
    overview ? (daily.days.find((day) => day.cumulative > overview.planned)?.day ?? null) : null,
  );

  const sources = await fetchSources(prisma, userId, month, timezoneOffset, cards);

  return {
    month,
    monthLabel: budget.periodLabel,
    previousMonth,
    isCurrentMonth: month === thisMonth,
    progress: { daysElapsed, daysInMonth, isPartial },
    income,
    spent,
    net: roundMoney(income - spent),
    burnPerDay,
    projected,
    versusPrevious: {
      change: trends.totalChange,
      previousTotal: trends.previousTotal,
      throughDay: trends.throughDay,
    },
    budget: overview,
    overBudget,
    monthly,
    daily,
    categories: buildCategories(trends, matrix),
    labels: labels.labels,
    sources,
    recent: ledger.rows,
    isEmpty: ledger.totals.count === 0,
  };
}
