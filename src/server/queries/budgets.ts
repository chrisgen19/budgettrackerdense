import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getBudgetPerformance } from "@bt/lib/budget-plans";
import { currentMonthKey } from "@bt/lib/credit-account-queries";
import { roundMoney } from "@bt/lib/money";
import type { BudgetPerformanceData } from "@bt/types";

/**
 * The Budgets page.
 *
 * Every figure comes from budgettracker's `getBudgetPerformance`, which owns
 * the rollover chain, the projection bases, safe-to-spend and the treatment
 * notes. This app adds exactly one thing: when there is no plan for the month,
 * it looks back for the most recent month that had one, so the empty state can
 * say what was last planned instead of only that nothing is.
 *
 * `getBudgetPerformance` reaches the database through the vendored prisma shim
 * rather than a passed client, so its signature is `(userId, month, tz)`. The
 * timezone is still passed explicitly: the month's window, and which day counts
 * as elapsed, are the user's.
 */

export interface LastPlan {
  month: string;
  /** Long label for the month, e.g. "August 2026". */
  label: string;
  revision: number;
  plannedExpenses: number;
  allocations: number;
}

export interface Budgets {
  month: string;
  isCurrentMonth: boolean;
  performance: BudgetPerformanceData;
  /** True when no `BudgetPlan` row exists for this month. */
  hasNoPlan: boolean;
  /**
   * The most recent earlier month that does have a plan, or null.
   * Only read when this month has none; there is nothing to compare otherwise.
   */
  lastPlan: LastPlan | null;
}

/** The long month name for a `YYYY-MM` key, read literally in UTC. */
function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

/**
 * The newest plan before `month`, summarised.
 *
 * Only the latest revision of that month counts: a plan is revised in place and
 * the older revisions are history, not separate plans.
 */
async function fetchLastPlan(
  prisma: PrismaClient,
  userId: string,
  month: string,
): Promise<LastPlan | null> {
  const plan = await prisma.budgetPlan.findFirst({
    where: { userId, month: { lt: month } },
    orderBy: [{ month: "desc" }, { revision: "desc" }],
    select: {
      month: true,
      revision: true,
      allocations: { select: { amount: true, category: { select: { type: true } } } },
    },
  });

  if (!plan) return null;

  const expenses = plan.allocations.filter((row) => row.category.type === "EXPENSE");

  return {
    month: plan.month,
    label: monthLabel(plan.month),
    revision: plan.revision,
    // `BudgetAllocation.amount` is a Prisma Decimal; convert once, here at the
    // boundary (AGENTS.md).
    plannedExpenses: roundMoney(
      expenses.reduce((sum, row) => sum + Number(row.amount), 0),
    ),
    allocations: plan.allocations.length,
  };
}

export async function fetchBudgets(
  prisma: PrismaClient,
  userId: string,
  { timezoneOffset, month }: { timezoneOffset: number; month?: string },
): Promise<Budgets> {
  const thisMonth = currentMonthKey(timezoneOffset);
  const key = month ?? thisMonth;

  const performance = await getBudgetPerformance(userId, key, timezoneOffset);
  const hasNoPlan = performance.plan === null;

  return {
    month: key,
    isCurrentMonth: key === thisMonth,
    performance,
    hasNoPlan,
    lastPlan: hasNoPlan ? await fetchLastPlan(prisma, userId, key) : null,
  };
}
