import "server-only";
import type { PrismaClient } from "@prisma/client";
import { getCategoryList, getLabelList } from "@bt/lib/budget-queries";
import {
  type CreditAccountSummary,
  getCreditAccountSummaries,
} from "@bt/lib/credit-account-queries";
import type { CategoryItem, LabelItem } from "@bt/lib/budget-query-types";
import { PAGE_SIZE, type LedgerFilters, windowOf } from "@/lib/ledger-filters";
import { type Ledger, fetchLedger } from "./ledger";

/**
 * The Ledger page's read: one page of rows plus the lists the filter bar needs.
 *
 * The rows come from this app's own `fetchLedger`, which is the reason it
 * exists: budgettracker's `searchTransactions` filters by type, category,
 * amount and description, but not by label or by card, and the dense ledger is
 * read for exactly those two questions.
 *
 * `timezoneOffset` is passed explicitly into every call. The vendored queries
 * default it to UTC, which puts a UTC+8 user's late-evening rows on the wrong
 * day and therefore in the wrong month.
 */
export interface LedgerPage {
  ledger: Ledger;
  categories: CategoryItem[];
  labels: LabelItem[];
  cards: CreditAccountSummary[];
  /** No rows matched. Separate from "no rows exist", which the page works out. */
  isEmpty: boolean;
}

export async function fetchLedgerPage(
  prisma: PrismaClient,
  userId: string,
  filters: LedgerFilters,
  timezoneOffset: number,
): Promise<LedgerPage> {
  const [ledger, categories, labels, cards] = await Promise.all([
    fetchLedger(prisma, userId, {
      ...windowOf(filters),
      timezoneOffset,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.labelIds.length > 0 ? { labelIds: filters.labelIds } : {}),
      ...(filters.card ? { creditAccountId: filters.card } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.amountMin !== null ? { amountMin: filters.amountMin } : {}),
      ...(filters.amountMax !== null ? { amountMax: filters.amountMax } : {}),
      page: filters.page,
      limit: PAGE_SIZE,
    }),
    getCategoryList(prisma, userId),
    getLabelList(prisma, userId),
    getCreditAccountSummaries(prisma, userId, { includeArchived: true }),
  ]);

  return { ledger, categories, labels, cards, isEmpty: ledger.totals.count === 0 };
}
