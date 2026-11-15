import "server-only";
import type { PrismaClient } from "@prisma/client";
import {
  type CreditAccountDetail,
  type CreditAccountSummary,
  currentMonthKey,
  getCreditAccountDetail,
  getCreditAccountSummaries,
  monthWindow,
} from "@bt/lib/credit-account-queries";
import { type CardInterestState, describeCardInterest } from "@bt/lib/card-interest";
import { overallUtilizationOf } from "@bt/lib/card-interest";

/**
 * The Cards pages.
 *
 * Every figure here is budgettracker's: `getCreditAccountSummaries` for the
 * list, `getCreditAccountDetail` for one card's month, `computeAccountBalance`
 * for the month's opening and closing balances, `describeCardInterest` for the
 * untracked-versus-zero distinction. This app derives none of it again.
 *
 * **A card payment is not a transaction.** A purchase is an ordinary EXPENSE
 * carrying `credit_account_id` and counts everywhere expenses count; paying the
 * card is a `CreditPayment` row that lives outside `transactions` entirely
 * (budgettracker `.claude/rules/cards.md`). Nothing on these pages adds the two
 * together, and `src/server/queries/cards.test.ts` pins that.
 *
 * `timezoneOffset` is passed explicitly into every call: the month window a
 * card's purchases fall in is the user's, not the container's.
 */

export interface CardsList {
  cards: CreditAccountSummary[];
  /** Total owed across every card, archived ones included. */
  totalOwed: number;
  /** Portfolio utilization, or null when no card records a limit. */
  utilization: ReturnType<typeof overallUtilizationOf>;
  isEmpty: boolean;
}

/** Every card the user has, newest balances first. */
export async function fetchCards(
  prisma: PrismaClient,
  userId: string,
  { timezoneOffset }: { timezoneOffset: number },
): Promise<CardsList> {
  // Archived cards are included: deleting a card with history archives it
  // whatever it still owes, and money owed does not stop being owed.
  const cards = await getCreditAccountSummaries(prisma, userId, {
    includeArchived: true,
    asOf: monthWindow(currentMonthKey(timezoneOffset), timezoneOffset).end,
  });

  return {
    cards,
    totalOwed: Math.round(cards.reduce((sum, card) => sum + card.balance, 0) * 100) / 100,
    utilization: overallUtilizationOf(
      // `isActive` matters: a settled archived card is dropped from both sides,
      // while an archived card that still owes keeps its limit. See the
      // reasoning in the vendored `overallUtilizationOf`.
      cards.map((card) => ({
        balance: card.balance,
        creditLimit: card.creditLimit,
        isActive: card.isActive,
      })),
    ),
    isEmpty: cards.length === 0,
  };
}

export interface CardMonth {
  detail: CreditAccountDetail;
  month: string;
  /** What the card owed the instant the month began. */
  openingBalance: number;
  /** What it owed the instant it ended. */
  closingBalance: number;
  /**
   * The card's own recorded opening balance, when its `openingBalanceDate`
   * falls inside this month, else 0.
   *
   * Without it the month does not add up, and it is not a rounding gap: this
   * card's balance appears on 6 August, so August opens at 0, takes 7,295.28 of
   * purchases and closes at 81,566.08. Naming the 74,270.80 is the only honest
   * way to show a month that starts before the card's history does.
   */
  openedWith: number;
  /** Untracked, none-this-period or charged. Never a bare zero. */
  interest: CardInterestState;
  /** Nothing was bought or paid on this card in this month. */
  isEmpty: boolean;
}

/**
 * One card for one month.
 *
 * Both bounds are read the same way, as a summary `asOf` an instant, rather
 * than one being derived from the other. A card's recorded opening balance only
 * counts from its own `openingBalanceDate` (`openingBalanceAsOf`), so deriving
 * the close as `opening + purchases - payments` silently drops it whenever that
 * date lands inside the month being shown.
 */
export async function fetchCardMonth(
  prisma: PrismaClient,
  userId: string,
  cardId: string,
  { timezoneOffset, month }: { timezoneOffset: number; month?: string },
): Promise<CardMonth | null> {
  const key = month ?? currentMonthKey(timezoneOffset);
  const window = monthWindow(key, timezoneOffset);

  const balanceAt = (asOf: Date) =>
    getCreditAccountSummaries(prisma, userId, { includeArchived: true, asOf });

  const [detail, before, after] = await Promise.all([
    getCreditAccountDetail(prisma, userId, cardId, key, timezoneOffset),
    balanceAt(new Date(window.start.getTime() - 1)),
    balanceAt(window.end),
  ]);

  if (!detail) return null;

  const balanceOf = (cards: CreditAccountSummary[]) =>
    cards.find((card) => card.id === cardId)?.balance ?? 0;

  const openingBalance = balanceOf(before);
  const closingBalance = balanceOf(after);
  const { totals } = detail.period;

  // Whatever the month's activity does not explain is the card's own opening
  // balance arriving inside it.
  const movement = totals.purchases - totals.payments - totals.credits;
  const openedWith = Math.round((closingBalance - openingBalance - movement) * 100) / 100;

  return {
    detail,
    month: key,
    openingBalance,
    closingBalance,
    openedWith,
    interest: describeCardInterest(detail.interest),
    isEmpty:
      detail.purchases.length === 0 &&
      detail.payments.length === 0 &&
      totals.purchases === 0 &&
      totals.payments === 0 &&
      totals.credits === 0 &&
      openedWith === 0,
  };
}
