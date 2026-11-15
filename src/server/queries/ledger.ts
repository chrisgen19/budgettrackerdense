/**
 * The ledger query: one month (or explicit range) of transactions, grouped by
 * the user's own calendar day.
 *
 * budgettracker's `searchTransactions` filters by type, category, amount and
 * description only. The dense ledger also filters by **label** and by **card**,
 * and it needs day grouping with per-day subtotals, so it is written here. The
 * window rules are not: they come from `resolveWindow`, which defers to the
 * shared `describePeriod`.
 */
import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { PeriodParams, ResolvedPeriod, TransactionType } from "@bt/lib/budget-query-types";
import { roundMoney } from "@bt/lib/money";
import { localCalendarDay } from "@bt/lib/period-progress";
import { resolveWindow } from "./period";

/** Page size when the caller names none. Dense tables show a lot at once. */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export interface LedgerParams extends PeriodParams {
  /** `Date.getTimezoneOffset()` minutes, from `users.timezone_offset`. UTC+8 is -480. */
  timezoneOffset: number;
  type?: TransactionType;
  categoryId?: string;
  /** Rows carrying at least one of these labels. Empty is treated as unset. */
  labelIds?: string[];
  /** Rows paid with one of these cards. `"none"` means "no card", for cash-only review. */
  creditAccountId?: string | "none";
  /** Case-insensitive substring of the description. */
  search?: string;
  amountMin?: number;
  amountMax?: number;
  sortDir?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface LedgerRow {
  id: string;
  amount: number;
  description: string;
  type: TransactionType;
  /** The stored instant, for ordering and time of day. */
  date: Date;
  /** The same moment as the user's own calendar day, YYYY-MM-DD. */
  localDate: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  creditAccountId: string | null;
  creditAccountName: string | null;
  receiptGroupId: string | null;
  labels: Array<{ id: string; name: string; color: string }>;
}

export interface LedgerDay {
  /** YYYY-MM-DD in the user's timezone. */
  day: string;
  income: number;
  expenses: number;
  rows: LedgerRow[];
}

export interface Ledger {
  period: ResolvedPeriod;
  /** The rows of this page, newest first by default. */
  rows: LedgerRow[];
  /** The same rows grouped by local day, in the order they appear. */
  days: LedgerDay[];
  /** Over every match, not just this page. */
  totals: { count: number; income: number; expenses: number; net: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Coerce a caller-supplied positive integer, falling back rather than inventing rows. */
function positiveInt(value: number | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined || !Number.isSafeInteger(value) || value < 1) return fallback;
  return Math.min(value, max);
}

function buildWhere(
  userId: string,
  params: LedgerParams,
  dateFilter: { gte?: Date; lte?: Date },
): Prisma.TransactionWhereInput {
  const labelIds = params.labelIds?.filter(Boolean) ?? [];
  const { amountMin, amountMax } = params;

  return {
    userId,
    ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.search ? { description: { contains: params.search, mode: "insensitive" } } : {}),
    ...(amountMin !== undefined || amountMax !== undefined
      ? {
          amount: {
            ...(amountMin !== undefined ? { gte: amountMin } : {}),
            ...(amountMax !== undefined ? { lte: amountMax } : {}),
          },
        }
      : {}),
    ...(params.creditAccountId === "none"
      ? { creditAccountId: null }
      : params.creditAccountId
        ? { creditAccountId: params.creditAccountId }
        : {}),
    ...(labelIds.length > 0 ? { labels: { some: { labelId: { in: labelIds } } } } : {}),
  };
}

/** Fold the page's rows into local days, keeping the order the rows arrived in. */
function groupByDay(rows: LedgerRow[]): LedgerDay[] {
  const days = new Map<string, LedgerDay>();

  for (const row of rows) {
    let day = days.get(row.localDate);
    if (!day) {
      day = { day: row.localDate, income: 0, expenses: 0, rows: [] };
      days.set(row.localDate, day);
    }
    day.rows.push(row);
    if (row.type === "INCOME") day.income += row.amount;
    else day.expenses += row.amount;
  }

  return [...days.values()].map((day) => ({
    ...day,
    income: roundMoney(day.income),
    expenses: roundMoney(day.expenses),
  }));
}

/**
 * One page of the ledger, plus totals over every match and day subtotals.
 *
 * Totals cover the whole window rather than the page: a dense table is read for
 * "how much", and summing the visible page answers a different question.
 */
export async function fetchLedger(
  prisma: PrismaClient,
  userId: string,
  params: LedgerParams,
): Promise<Ledger> {
  const { period, dateFilter } = resolveWindow(params, params.timezoneOffset);
  const where = buildWhere(userId, params, dateFilter);
  const limit = positiveInt(params.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const page = positiveInt(params.page, 1);

  const [total, grouped, found] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({ by: ["type"], where, _sum: { amount: true } }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: params.sortDir ?? "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { name: true, icon: true, color: true } },
        creditAccount: { select: { name: true } },
        labels: { include: { label: { select: { id: true, name: true, color: true } } } },
      },
    }),
  ]);

  const sumOf = (type: TransactionType): number =>
    roundMoney(grouped.find((row) => row.type === type)?._sum.amount ?? 0);
  const income = sumOf("INCOME");
  const expenses = sumOf("EXPENSE");

  const rows: LedgerRow[] = found.map((row) => ({
    id: row.id,
    amount: row.amount,
    description: row.description,
    type: row.type,
    date: row.date,
    localDate: localCalendarDay(row.date, params.timezoneOffset),
    categoryId: row.categoryId,
    categoryName: row.category.name,
    categoryIcon: row.category.icon,
    categoryColor: row.category.color,
    creditAccountId: row.creditAccountId,
    creditAccountName: row.creditAccount?.name ?? null,
    receiptGroupId: row.receiptGroupId,
    labels: row.labels.map(({ label }) => label),
  }));

  return {
    period,
    rows,
    days: groupByDay(rows),
    totals: { count: total, income, expenses, net: roundMoney(income - expenses) },
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
