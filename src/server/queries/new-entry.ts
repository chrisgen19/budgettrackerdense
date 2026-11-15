import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getCategoryList, getLabelList } from "@bt/lib/budget-queries";
import { getCreditAccountSummaries } from "@bt/lib/credit-account-queries";
import { localCalendarDay } from "@bt/lib/period-progress";
import type { ParseCard, ParseCategory, ParseLabel } from "@/lib/command-parser";
import { QUICK_COUNT } from "@/lib/entry-draft";
import { denseSource, writesEnabled } from "@/server/writes";

/**
 * Everything the New entry page needs, read once per page load: the user's
 * categories, labels and cards for the parser and the chips, whether saving is
 * on, and the last entries made here.
 *
 * The lists are budgettracker's own (`getCategoryList`, `getLabelList`,
 * `getCreditAccountSummaries`). The one dense read is recent usage, which
 * decides the "quick" categories the parser searches first and the chips shown
 * before "more".
 */

/** How far back "recently used" looks. */
const QUICK_WINDOW_DAYS = 90;
/** How many entries made here are listed under the form. */
export const RECENT_COUNT = 10;

export interface RecentEntry {
  id: string;
  date: string;
  amount: number;
  type: "EXPENSE" | "INCOME";
  description: string;
  categoryName: string;
  labelNames: string[];
}

export interface EntryContext {
  /** The user's calendar day, `YYYY-MM-DD`. */
  today: string;
  timezoneOffset: number;
  /** Most used first within each type. */
  categories: ParseCategory[];
  /** Most used first. */
  labels: ParseLabel[];
  /** Active cards only: an archived card cannot take a new purchase. */
  cards: ParseCard[];
  /** False until the DENSE source exists in the client and the database (plan 07 step 0). */
  canSave: boolean;
  /** Empty while saving is off: there is nothing to list, and no DENSE value to filter by. */
  recent: RecentEntry[];
}

/** Category ids by how often they were used recently, most first. */
async function categoryUsage(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<Map<string, number>> {
  const since = new Date(now.getTime() - QUICK_WINDOW_DAYS * 86_400_000);
  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { userId, date: { gte: since } },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.categoryId, row._count._all]));
}

async function recentEntries(prisma: PrismaClient, userId: string): Promise<RecentEntry[]> {
  const source = denseSource();
  if (source === null) return [];

  const rows = await prisma.transaction.findMany({
    where: { userId, createdVia: source },
    orderBy: { createdAt: "desc" },
    take: RECENT_COUNT,
    select: {
      id: true,
      date: true,
      amount: true,
      type: true,
      description: true,
      category: { select: { name: true } },
      labels: { select: { label: { select: { name: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    date: row.date.toISOString(),
    amount: row.amount,
    type: row.type,
    description: row.description,
    categoryName: row.category.name,
    labelNames: row.labels.map(({ label }) => label.name),
  }));
}

export async function fetchEntryContext(
  prisma: PrismaClient,
  userId: string,
  { timezoneOffset, now = new Date() }: { timezoneOffset: number; now?: Date },
): Promise<EntryContext> {
  const [categories, labels, cards, usage, canSave] = await Promise.all([
    getCategoryList(prisma, userId),
    getLabelList(prisma, userId),
    getCreditAccountSummaries(prisma, userId),
    categoryUsage(prisma, userId, now),
    writesEnabled(),
  ]);

  const used = (id: string) => usage.get(id) ?? 0;
  const byUse = [...categories].sort((a, b) => used(b.id) - used(a.id) || a.name.localeCompare(b.name));
  const quick = new Set<string>();
  for (const type of ["EXPENSE", "INCOME"] as const) {
    byUse
      .filter((category) => category.type === type && used(category.id) > 0)
      .slice(0, QUICK_COUNT)
      .forEach((category) => quick.add(category.id));
  }

  return {
    today: localCalendarDay(now, timezoneOffset),
    timezoneOffset,
    categories: byUse.map((category) => ({
      id: category.id,
      name: category.name,
      type: category.type,
      quick: quick.has(category.id),
    })),
    labels: [...labels]
      .sort((a, b) => b.transactionCount - a.transactionCount || a.name.localeCompare(b.name))
      .map((label) => ({ id: label.id, name: label.name, applicableTo: label.applicableTo })),
    cards: cards.map((card) => ({ id: card.id, name: card.name })),
    canSave,
    recent: canSave ? await recentEntries(prisma, userId) : [],
  };
}
